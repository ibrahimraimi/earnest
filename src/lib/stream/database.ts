/**
 * PocketBase Integration Module for Stream Chat
 * 
 * This module handles the integration between Stream Chat and your PocketBase database.
 * It ensures data consistency, tracks interactions, and provides hybrid functionality.
 */

/**
 * Interface for PocketBase comment record
 */
export interface PocketBaseComment {
	id: string;
	content_id: string;
	user_id: string;
	channel_id: string;
	created: string;
	updated: string;
}

/**
 * Interface for PocketBase interaction record
 */
export interface PocketBaseInteraction {
	id: string;
	user_id: string;
	content_id: string;
	comment_id?: string;
	type: 'view' | 'like' | 'save' | 'share';
	created: string;
	updated: string;
}

/**
 * Interface for PocketBase content record
 */
export interface PocketBaseContent {
	id: string;
	creator_id: string;
	title: string;
	description?: string;
	content_type: 'audio' | 'video';
	duration: number;
	category: string;
	view_count?: number;
	like_count?: number;
	comment_count?: number;
	is_premium?: boolean;
	price?: number;
	meta_data: any;
	created: string;
	updated: string;
}

/**
 * Interface for PocketBase user record
 */
export interface PocketBaseUser {
	id: string;
	username: string;
	email: string;
	name: string;
	avatar?: string;
	role: 'client' | 'creator';
	bio?: string;
	banner?: string;
	stripe_connect_id: string;
	is_active: boolean;
	created: string;
	updated: string;
}

/**
 * Ensures a comment channel exists for content and creates PocketBase record
 * 
 * @param pb - PocketBase instance
 * @param contentId - Content identifier
 * @param userId - User identifier
 * @returns Promise<string> - Channel ID
 * @throws Error if operation fails
 */
export async function ensureCommentChannel(
	pb: any,
	contentId: string,
	userId: string
): Promise<string> {
	if (!pb || !contentId || !userId) {
		throw new Error('PocketBase instance, content ID, and user ID are required');
	}

	try {
		// Escape double quotes in contentId to prevent injection
		// Check if comment record already exists
		const existingComments = await pb.collection('comments').getList(1, 1, {
		  filter: pb.filter('content_id = {:contentId}', { contentId })
		});

		let channelId: string;

		if (existingComments.items.length > 0) {
			// Use existing channel ID
			channelId = existingComments.items[0].channel_id;
		} else {
			// Create new channel ID and record
			channelId = `comments_${contentId}`;
			
			await pb.collection('comments').create({
				content_id: contentId,
				user_id: userId,
				channel_id: channelId
			});
		}

		return channelId;
	} catch (error) {
		console.error('Failed to ensure comment channel:', error);
		throw new Error('Failed to ensure comment channel exists');
	}
}

/**
 * Updates content statistics based on interactions
 * 
 * @param pb - PocketBase instance
 * @param contentId - Content identifier
 * @param type - Type of interaction
 * @param increment - Whether to increment (true) or decrement (false)
 * @returns Promise<void>
 */
export async function updateContentStats(
	pb: any,
	contentId: string,
	type: 'view' | 'like' | 'comment',
	increment: boolean = true
): Promise<void> {
	if (!pb || !contentId) {
		return;
	}

	try {
		const content = await pb.collection('content').getOne(contentId);
		const delta = increment ? 1 : -1;

		let updateData: any = {};

		switch (type) {
			case 'view':
				updateData.view_count = Math.max(0, (content.view_count || 0) + delta);
				break;
			case 'like':
				updateData.like_count = Math.max(0, (content.like_count || 0) + delta);
				break;
			case 'comment':
				updateData.comment_count = Math.max(0, (content.comment_count || 0) + delta);
				break;
		}

		await pb.collection('content').update(contentId, updateData);
	} catch (error) {
		console.warn('Failed to update content stats:', error);
		// Don't throw error to avoid breaking main functionality
	}
}

/**
 * Records user interaction in PocketBase
 * 
 * @param pb - PocketBase instance
 * @param userId - User identifier
 * @param contentId - Content identifier
 * @param type - Type of interaction
 * @param commentId - Optional comment identifier
 * @returns Promise<PocketBaseInteraction | null>
 */
export async function recordInteraction(
	pb: any,
	userId: string,
	contentId: string,
	type: 'view' | 'like' | 'save' | 'share',
	commentId?: string
): Promise<PocketBaseInteraction | null> {
	if (!pb || !userId || !contentId) {
		return null;
	}

	try {
		// Check if interaction already exists (for like, save, share)
		if (type !== 'view') {
			const existingInteraction = await pb.collection('interaction').getList(1, 1, {
				filter: `user_id="${userId}" && content_id="${contentId}" && type="${type}"${commentId ? ` && comment_id="${commentId}"` : ''}`
			});

			if (existingInteraction.items.length > 0) {
				// For toggle interactions (like, save), delete the existing one
				if (type === 'like' || type === 'save') {
					await pb.collection('interaction').delete(existingInteraction.items[0].id);
					
					// Update content stats (decrement)
					if (type === 'like') {
						await updateContentStats(pb, contentId, 'like', false);
					}
					
					return null; // Indicates interaction was removed
				}
				
				return existingInteraction.items[0]; // Return existing interaction
			}
		}

		// Create new interaction
		const interactionData: any = {
			user_id: userId,
			content_id: contentId,
			type: type
		};

		if (commentId) {
			interactionData.comment_id = commentId;
		}

		const interaction = await pb.collection('interaction').create(interactionData);

		// Update content stats (increment)
		if (type === 'like') {
			await updateContentStats(pb, contentId, 'like', true);
		} else if (type === 'view') {
			await updateContentStats(pb, contentId, 'view', true);
		}

		return interaction;
	} catch (error) {
		console.warn('Failed to record interaction:', error);
		return null;
	}
}

/**
 * Gets user interactions for content
 * 
 * @param pb - PocketBase instance
 * @param userId - User identifier
 * @param contentId - Content identifier
 * @returns Promise<PocketBaseInteraction[]>
 */
export async function getUserInteractions(
	pb: any,
	userId: string,
	contentId: string
): Promise<PocketBaseInteraction[]> {
	if (!pb || !userId || !contentId) {
		return [];
	}

	try {
		const interactions = await pb.collection('interaction').getList(1, 100, {
			filter: `user_id="${userId}" && content_id="${contentId}"`
		});

		return interactions.items;
	} catch (error) {
		console.warn('Failed to get user interactions:', error);
		return [];
	}
}

/**
 * Creates a report for content or comment
 * 
 * @param pb - PocketBase instance
 * @param reporterId - User reporting the content/comment
 * @param contentId - Content identifier
 * @param reason - Reason for the report
 * @param commentId - Optional comment identifier
 * @returns Promise<any> - Created report record
 */
export async function createReport(
	pb: any,
	reporterId: string,
	contentId: string,
	reason: string,
	commentId?: string
): Promise<any> {
	if (!pb || !reporterId || !contentId || !reason) {
		throw new Error('PocketBase instance, reporter ID, content ID, and reason are required');
	}

	try {
		const reportData: any = {
			reporter_id: reporterId,
			content_id: contentId,
			reason: reason,
			status: 'pending'
		};

		if (commentId) {
			reportData.comment_id = commentId;
		}

		const report = await pb.collection('reports').create(reportData);
		return report;
	} catch (error) {
		console.error('Failed to create report:', error);
		throw new Error('Failed to create report');
	}
}

/**
 * Gets content information from PocketBase
 * 
 * @param pb - PocketBase instance
 * @param contentId - Content identifier
 * @returns Promise<PocketBaseContent | null>
 */
export async function getContentInfo(
	pb: any,
	contentId: string
): Promise<PocketBaseContent | null> {
	if (!pb || !contentId) {
		return null;
	}

	try {
		const content = await pb.collection('content').getOne(contentId);
		return content;
	} catch (error) {
		console.warn('Failed to get content info:', error);
		return null;
	}
}

/**
 * Gets user information from PocketBase
 * 
 * @param pb - PocketBase instance
 * @param userId - User identifier
 * @returns Promise<PocketBaseUser | null>
 */
export async function getUserInfo(
	pb: any,
	userId: string
): Promise<PocketBaseUser | null> {
	if (!pb || !userId) {
		return null;
	}

	try {
		const user = await pb.collection('users').getOne(userId);
		return user;
	} catch (error) {
		console.warn('Failed to get user info:', error);
		return null;
	}
}

/**
 * Syncs Stream Chat message count with PocketBase content stats
 * 
 * @param pb - PocketBase instance
 * @param contentId - Content identifier
 * @param messageCount - Current message count from Stream
 * @returns Promise<void>
 */
export async function syncMessageCount(
	pb: any,
	contentId: string,
	messageCount: number
): Promise<void> {
	if (!pb || !contentId || messageCount < 0) {
		return;
	}

	try {
		await pb.collection('content').update(contentId, {
			comment_count: messageCount
		});
	} catch (error) {
		console.warn('Failed to sync message count:', error);
	}
}

/**
 * Gets content statistics from PocketBase
 * 
 * @param pb - PocketBase instance
 * @param contentId - Content identifier
 * @returns Promise<{view_count: number, like_count: number, comment_count: number}>
 */
export async function getContentStats(
	pb: any,
	contentId: string
): Promise<{view_count: number, like_count: number, comment_count: number}> {
	const defaultStats = { view_count: 0, like_count: 0, comment_count: 0 };
	
	if (!pb || !contentId) {
		return defaultStats;
	}

	try {
		const content = await pb.collection('content').getOne(contentId);
		return {
			view_count: content.view_count || 0,
			like_count: content.like_count || 0,
			comment_count: content.comment_count || 0
		};
	} catch (error) {
		console.warn('Failed to get content stats:', error);
		return defaultStats;
	}
}

/**
 * Checks if user has specific permission for content
 * 
 * @param pb - PocketBase instance
 * @param userId - User identifier
 * @param contentId - Content identifier
 * @param permission - Permission type ('view', 'comment', 'moderate')
 * @returns Promise<boolean>
 */
export async function checkUserPermission(
	pb: any,
	userId: string,
	contentId: string,
	permission: 'view' | 'comment' | 'moderate'
): Promise<boolean> {
	if (!pb || !userId || !contentId) {
		return false;
	}

	try {
		const content = await pb.collection('content').getOne(contentId);
		const user = await pb.collection('users').getOne(userId);

		// Content creator always has all permissions
		if (content.creator_id === userId) {
			return true;
		}

		// Check if content is premium and user has access
		if (content.is_premium) {
			// Check for premium subscription
			const subscription = await pb.collection('premium_subscriptions').getList(1, 1, {
				filter: `subscriber_id="${userId}" && creator_id="${content.creator_id}" && status="active"`
			});

			if (subscription.items.length === 0) {
				// No premium access, only allow viewing for non-premium content
				return permission === 'view' && !content.is_premium;
			}
		}

		// Check user status
		if (!user.is_active) {
			return false;
		}

		// Basic permissions based on user role
		switch (permission) {
			case 'view':
				return true; // All active users can view
			case 'comment':
				return true; // All active users can comment
			case 'moderate':
				return user.role === 'creator' || content.creator_id === userId;
			default:
				return false;
		}
	} catch (error) {
		console.warn('Failed to check user permission:', error);
		return false;
	}
}
