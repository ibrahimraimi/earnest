import { serverClient, STREAM_CONFIG } from './server-config.js';
import { clientStreamInstance } from './config.js';
import type { StreamUser } from './auth.js';
import type { Channel } from 'stream-chat';

/**
 * Stream Chat Channel Management Module
 *
 * This module handles channel operations for the comment system.
 * It provides functions for creating, watching, and managing channels
 * specifically designed for YouTube/Instagram-like comment sections.
 */

/**
 * Interface for channel creation options
 */
export interface ChannelCreateOptions {
	name?: string;
	image?: string;
	description?: string;
	content_type?: 'video' | 'post' | 'live' | 'story';
	content_url?: string;
	metadata?: Record<string, any>;
}

/**
 * Interface for channel query options
 */
export interface ChannelQueryOptions {
	watch?: boolean;
	state?: boolean;
	presence?: boolean;
	messages?: {
		limit?: number;
		offset?: number;
	};
	members?: {
		limit?: number;
		offset?: number;
	};
	watchers?: {
		limit?: number;
		offset?: number;
	};
}

/**
 * Interface for channel response
 */
export interface ChannelResponse {
	channel_id: string;
	cid: string;
	type: string;
	name?: string;
	image?: string;
	created_at: string;
	updated_at: string;
	member_count: number;
	watcher_count: number;
	message_count: number;
	online_count: number;
}

/**
 * Creates a comment channel for content and stores it in PocketBase
 *
 * Each piece of content gets its own channel for comments.
 * Channel ID is based on content ID to ensure uniqueness.
 * Also creates or updates the corresponding PocketBase comment record.
 *
 * @param contentId - Unique identifier for the content (video ID, post ID, etc.)
 * @param userId - User creating/accessing the channel
 * @param options - Additional channel configuration options
 * @param pb - PocketBase instance for database operations
 * @returns Promise<ChannelResponse> - Created channel information
 * @throws Error if channel creation fails
 */
export async function createCommentChannel(
	contentId: string,
	userId: string,
	options: ChannelCreateOptions = {},
	pb?: any
): Promise<ChannelResponse> {
	if (!contentId || !userId) {
		throw new Error('Content ID and User ID are required');
	}

	try {
		// Create channel ID based on content ID
		// Format: comments_{contentId} to ensure uniqueness
		const channelId = `comments_${contentId}`;

		// First, verify that the content exists in PocketBase
		let contentRecord = null;
		if (pb) {
			try {
				contentRecord = await pb.collection('content').getOne(contentId);
			} catch (err) {
				console.warn('Content not found in PocketBase:', contentId);
			}
		}

		// Prepare channel data
		const channelData = {
			name: options.name || contentRecord?.title || `Comments for ${contentId}`,
			image: options.image,
			description:
				options.description ||
				contentRecord?.description ||
				`Comment section for content ${contentId}`,
			created_by: { id: userId },

			// Custom fields for content metadata
			content_id: contentId,
			content_type: options.content_type || contentRecord?.content_type || 'video',
			content_url: options.content_url,
			creator_id: contentRecord?.creator_id || userId,

			// Additional metadata
			...options.metadata
		};

		// Create the channel using server client
		const channel = serverClient.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId,
			channelData
		);

		// Create the channel if it doesn't exist
		const channelState = await channel.create();

		// After creating the channel, ensure proper permissions by adding the user as a member
		// This ensures the user can read and write to the channel
		// Note: We're using 'gaming' channel type instead of 'messaging' because it has more permissive default permissions
		// This allows all authenticated users to read and write comments without permission errors
		try {
			await channel.addMembers([{ user_id: userId }]);
		} catch (memberError) {
			console.warn('Failed to add user as channel member:', memberError);
			// Don't fail the entire operation if adding member fails
		}

		// Store or update the channel reference in PocketBase comments collection
		if (pb) {
			try {
				// Check if a comment record already exists for this content
				const existingComments = await pb.collection('comments').getList(1, 1, {
					filter: `content_id="${contentId}"`
				});

				if (existingComments.items.length === 0) {
					// Create new comment record in PocketBase
					await pb.collection('comments').create({
						content_id: contentId,
						user_id: userId,
						channel_id: channelId
					});
				}
			} catch (pbError) {
				console.warn('Failed to store channel in PocketBase:', pbError);
				// Don't fail the entire operation if PocketBase storage fails
			}
		}

		return {
			channel_id: channelId,
			cid: channel.cid,
			type: STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			name: channelData.name,
			image: channelData.image,
			created_at: channelState.channel.created_at || new Date().toISOString(),
			updated_at: channelState.channel.updated_at || new Date().toISOString(),
			member_count: Object.keys(channelState.members || {}).length,
			watcher_count: channelState.watcher_count || 0,
			message_count: (channelState.channel as any).message_count || 0,
			online_count: (channelState as any).online || 0
		};
	} catch (error) {
		console.error('Failed to create comment channel:', error);

		// Provide more specific error messages for common issues
		if (error instanceof Error) {
			if (error.message.includes('permission')) {
				throw new Error(
					'Permission error creating comment channel. Please check user authentication and role.'
				);
			} else if (error.message.includes('channel')) {
				throw new Error('Channel creation failed. Please try again.');
			}
		}

		throw new Error('Failed to create comment channel');
	}
}

/**
 * Watches a comment channel (client-side operation)
 *
 * This operation:
 * - Creates the channel if it doesn't exist (with proper permissions)
 * - Queries channel state and returns members, watchers, and messages
 * - Starts watching for real-time updates
 *
 * @param contentId - Content identifier
 * @param options - Query options for channel state
 * @returns Promise<any> - Channel state with messages, members, etc.
 * @throws Error if watch operation fails
 */
export async function watchCommentChannel(
	contentId: string,
	options: ChannelQueryOptions = {}
): Promise<any> {
	if (!contentId) {
		throw new Error('Content ID is required');
	}

	try {
		const channelId = `comments_${contentId}`;

		// Get channel instance (client-side)
		const channel = clientStreamInstance.channel(STREAM_CONFIG.CHANNEL_TYPES.COMMENTS, channelId);

		// Watch the channel with specified options
		const watchOptions = {
			state: options.state !== false, // Default to true
			watch: options.watch !== false, // Default to true
			presence: options.presence || false,
			messages: options.messages || { limit: 25 },
			members: options.members || { limit: 100 },
			watchers: options.watchers || { limit: 100 }
		};

		const channelState = await channel.watch(watchOptions);

		return {
			channel: channelState.channel,
			messages: channelState.messages || [],
			members: channelState.members || {},
			watchers: channelState.watchers || {},
			online: (channelState as any).online || 0,
			watcher_count: channelState.watcher_count || 0
		};
	} catch (error) {
		console.error('Failed to watch comment channel:', error);
		throw new Error('Failed to watch comment channel');
	}
}

/**
 * Stops watching a comment channel
 *
 * @param contentId - Content identifier
 * @returns Promise<void>
 * @throws Error if stop watching fails
 */
export async function stopWatchingChannel(contentId: string): Promise<void> {
	if (!contentId) {
		throw new Error('Content ID is required');
	}

	try {
		const channelId = `comments_${contentId}`;
		const channel = clientStreamInstance.channel(STREAM_CONFIG.CHANNEL_TYPES.COMMENTS, channelId);

		await channel.stopWatching();
	} catch (error) {
		console.error('Failed to stop watching channel:', error);
		throw new Error('Failed to stop watching channel');
	}
}

/**
 * Queries multiple comment channels
 *
 * Useful for getting channels for multiple pieces of content,
 * or finding channels based on certain criteria.
 *
 * @param filter - Filter criteria for channels
 * @param sort - Sort options
 * @param options - Additional query options
 * @returns Promise<Channel[]> - Array of matching channels
 * @throws Error if query fails
 */
export async function queryCommentChannels(
	filter: Record<string, any> = {},
	sort: Record<string, number>[] = [{ last_message_at: -1 }],
	options: { limit?: number; offset?: number; watch?: boolean } = {}
): Promise<Channel[]> {
	try {
		// Default filter for comment channels
		const defaultFilter = {
			type: STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			...filter
		};

		const queryOptions = {
			limit: options.limit || 25,
			offset: options.offset || 0,
			watch: options.watch || false
		};

		const channels = await clientStreamInstance.queryChannels(defaultFilter, sort, queryOptions);

		return channels;
	} catch (error) {
		console.error('Failed to query comment channels:', error);
		throw new Error('Failed to query comment channels');
	}
}

/**
 * Gets channel information by content ID
 *
 * @param contentId - Content identifier
 * @returns Promise<ChannelResponse | null> - Channel information or null if not found
 */
export async function getChannelInfo(contentId: string): Promise<ChannelResponse | null> {
	if (!contentId) {
		throw new Error('Content ID is required');
	}

	try {
		const channelId = `comments_${contentId}`;

		// Query for the specific channel
		const channels = await queryCommentChannels({ id: channelId }, [], { limit: 1, watch: false });

		if (channels.length === 0) {
			return null;
		}

		const channel = channels[0];
		const state = channel.state;

		return {
			channel_id: channelId,
			cid: channel.cid,
			type: channel.type,
			name: (state as any).data?.name,
			image: (state as any).data?.image,
			created_at: (state as any).data?.created_at || new Date().toISOString(),
			updated_at: (state as any).data?.updated_at || new Date().toISOString(),
			member_count: Object.keys(state.members).length,
			watcher_count: state.watcher_count,
			message_count: (state as any).data?.message_count || 0,
			online_count: (state as any).online || 0
		};
	} catch (error) {
		console.error('Failed to get channel info:', error);
		return null;
	}
}

/**
 * Adds a user as a member to a comment channel
 *
 * @param contentId - Content identifier
 * @param userId - User to add as member
 * @param role - Member role (default: 'member')
 * @returns Promise<void>
 * @throws Error if adding member fails
 */
export async function addChannelMember(
	contentId: string,
	userId: string,
	role: string = 'member'
): Promise<void> {
	if (!contentId || !userId) {
		throw new Error('Content ID and User ID are required');
	}

	try {
		const channelId = `comments_${contentId}`;
		const channel = serverClient.channel(STREAM_CONFIG.CHANNEL_TYPES.COMMENTS, channelId);

		await channel.addMembers([{ user_id: userId }]);
	} catch (error) {
		console.error('Failed to add channel member:', error);
		throw new Error('Failed to add channel member');
	}
}

/**
 * Removes a user from a comment channel
 *
 * @param contentId - Content identifier
 * @param userId - User to remove
 * @returns Promise<void>
 * @throws Error if removing member fails
 */
export async function removeChannelMember(contentId: string, userId: string): Promise<void> {
	if (!contentId || !userId) {
		throw new Error('Content ID and User ID are required');
	}

	try {
		const channelId = `comments_${contentId}`;
		const channel = serverClient.channel(STREAM_CONFIG.CHANNEL_TYPES.COMMENTS, channelId);

		await channel.removeMembers([userId]);
	} catch (error) {
		console.error('Failed to remove channel member:', error);
		throw new Error('Failed to remove channel member');
	}
}
