import { serverClient, STREAM_CONFIG } from './server-config.js';
import { clientStreamInstance } from './config.js';
import type { Channel } from 'stream-chat';

/**
 * Stream Chat Reactions Management Module
 * 
 * This module handles all reaction operations for the comment system.
 * It provides functions for adding, removing, and querying reactions
 * on messages in comment channels.
 */

/**
 * Interface for reaction data
 */
export interface MessageReaction {
	type: string;
	score?: number;
	user_id?: string;
	user?: {
		id: string;
		name: string;
		image?: string;
	};
	created_at?: string;
	custom_data?: Record<string, any>;
}

/**
 * Interface for reaction options
 */
export interface ReactionOptions {
	enforce_unique?: boolean; // Replace all other reactions by this user
	skip_push?: boolean;
	emoji_code?: string; // Unicode emoji for push notifications
}

/**
 * Interface for reaction query options
 */
export interface ReactionQueryOptions {
	type?: string;
	user_id?: string;
	limit?: number;
	offset?: number;
}

/**
 * Interface for reaction pagination options
 */
export interface ReactionPaginationOptions {
	limit?: number;
	next?: string;
}

/**
 * Interface for reaction group (aggregated reactions)
 */
export interface ReactionGroup {
	type: string;
	count: number;
	sum_scores: number;
	first_reaction_at: string;
	last_reaction_at: string;
}

/**
 * Interface for formatted reaction response
 */
export interface FormattedReaction {
	type: string;
	score: number;
	user: {
		id: string;
		name: string;
		image?: string;
	};
	created_at: string;
	message_id: string;
	custom_data?: Record<string, any>;
}

/**
 * Common reaction types for YouTube/Instagram-like systems
 */
export const REACTION_TYPES = {
	LIKE: 'like',
	LOVE: 'love',
	LAUGH: 'haha',
	WOW: 'wow',
	SAD: 'sad',
	ANGRY: 'angry',
	CLAP: 'clap', // For Medium-style clap reactions
	FIRE: 'fire',
	HEART: 'heart',
	THUMBS_UP: 'thumbs_up',
	THUMBS_DOWN: 'thumbs_down'
} as const;

/**
 * Adds a reaction to a message
 * 
 * @param contentId - Content identifier (to get the channel)
 * @param messageId - Message to react to
 * @param userId - User adding the reaction
 * @param reactionType - Type of reaction (like, love, etc.)
 * @param options - Additional reaction options
 * @returns Promise<FormattedReaction> - The created reaction
 * @throws Error if reaction creation fails
 */
export async function addReaction(
	contentId: string,
	messageId: string,
	userId: string,
	reactionType: string,
	options: ReactionOptions & { score?: number; custom_data?: Record<string, any> } = {}
): Promise<FormattedReaction> {
	if (!contentId || !messageId || !userId || !reactionType) {
		throw new Error('Content ID, Message ID, User ID, and reaction type are required');
	}

	try {
		const channelId = `comments_${contentId}`;
		
		// Get channel instance
		const channel = serverClient.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId
		);

		// Prepare reaction data
		const reactionData: any = {
			type: reactionType,
			user_id: userId
		};

		// Add optional fields
		if (options.score !== undefined) {
			reactionData.score = Math.max(1, Math.floor(options.score)); // Minimum score of 1
		}

		if (options.custom_data) {
			Object.assign(reactionData, options.custom_data);
		}

		// Send options
		const sendOptions: any = {};
		if (options.enforce_unique) {
			sendOptions.enforce_unique = true;
		}
		if (options.skip_push) {
			sendOptions.skip_push = true;
		}
		if (options.emoji_code) {
			sendOptions.emoji_code = options.emoji_code;
		}

		// Add the reaction
		const response = await channel.sendReaction(messageId, reactionData, sendOptions);

		return formatReaction(response.reaction, messageId);
	} catch (error) {
		console.error('Failed to add reaction:', error);
		throw new Error('Failed to add reaction');
	}
}

/**
 * Removes a reaction from a message
 * 
 * @param contentId - Content identifier
 * @param messageId - Message to remove reaction from
 * @param userId - User removing the reaction
 * @param reactionType - Type of reaction to remove
 * @returns Promise<void>
 * @throws Error if reaction removal fails
 */
export async function removeReaction(
	contentId: string,
	messageId: string,
	userId: string,
	reactionType: string
): Promise<void> {
	if (!contentId || !messageId || !userId || !reactionType) {
		throw new Error('Content ID, Message ID, User ID, and reaction type are required');
	}

	try {
		const channelId = `comments_${contentId}`;
		
		// Get channel instance
		const channel = serverClient.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId
		);

		// Remove the reaction
		await channel.deleteReaction(messageId, reactionType, userId);
	} catch (error) {
		console.error('Failed to remove reaction:', error);
		throw new Error('Failed to remove reaction');
	}
}

/**
 * Gets reactions for a specific message
 * 
 * @param contentId - Content identifier
 * @param messageId - Message to get reactions for
 * @param options - Query options for filtering and pagination
 * @returns Promise<FormattedReaction[]> - Array of reactions
 * @throws Error if query fails
 */
export async function getMessageReactions(
	contentId: string,
	messageId: string,
	options: ReactionQueryOptions = {}
): Promise<FormattedReaction[]> {
	if (!contentId || !messageId) {
		throw new Error('Content ID and Message ID are required');
	}

	try {
		const channelId = `comments_${contentId}`;
		
		// Get channel instance
		const channel = clientStreamInstance.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId
		);

		// Prepare query options
		const queryOptions: any = {
			limit: Math.min(options.limit || 10, 300), // Max 300
			offset: Math.min(options.offset || 0, 1000) // Max 1000
		};

		if (options.type) {
			queryOptions.type = options.type;
		}

		if (options.user_id) {
			queryOptions.user_id = options.user_id;
		}

		// Get reactions
		const response = await channel.getReactions(messageId, queryOptions);

		return (response.reactions || []).map(reaction => 
			formatReaction(reaction, messageId)
		);
	} catch (error) {
		console.error('Failed to get message reactions:', error);
		throw new Error('Failed to get message reactions');
	}
}

/**
 * Queries reactions across messages with advanced filtering
 * 
 * @param messageId - Message to query reactions for
 * @param filter - Filter criteria (type, user_id, etc.)
 * @param pagination - Pagination options
 * @returns Promise<{ reactions: FormattedReaction[]; next?: string }> - Reactions with pagination
 * @throws Error if query fails
 */
export async function queryReactions(
	messageId: string,
	filter: { type?: string; user_id?: string } = {},
	pagination: ReactionPaginationOptions = {}
): Promise<{ reactions: FormattedReaction[]; next?: string }> {
	if (!messageId) {
		throw new Error('Message ID is required');
	}

	try {
		const queryOptions: any = {};
		
		if (pagination.limit) {
			queryOptions.limit = Math.min(pagination.limit, 300);
		}
		
		if (pagination.next) {
			queryOptions.next = pagination.next;
		}

		const response = await serverClient.queryReactions(messageId, filter, {}, queryOptions);

		return {
			reactions: (response.reactions || []).map(reaction => 
				formatReaction(reaction, messageId)
			),
			next: response.next
		};
	} catch (error) {
		console.error('Failed to query reactions:', error);
		throw new Error('Failed to query reactions');
	}
}

/**
 * Adds a clap-style reaction (cumulative scoring)
 * Similar to Medium's clap system where users can clap multiple times
 * 
 * @param contentId - Content identifier
 * @param messageId - Message to clap for
 * @param userId - User adding claps
 * @param clapCount - Number of claps to add (default: 1)
 * @param options - Additional options
 * @returns Promise<FormattedReaction> - The clap reaction
 * @throws Error if clap addition fails
 */
export async function addClapReaction(
	contentId: string,
	messageId: string,
	userId: string,
	clapCount: number = 1,
	options: ReactionOptions = {}
): Promise<FormattedReaction> {
	if (!Number.isInteger(clapCount) || clapCount < 1 || clapCount > 50) {
	  throw new Error('Clap count must be an integer between 1 and 50');
	}

	return addReaction(
		contentId,
		messageId,
		userId,
		REACTION_TYPES.CLAP,
		{
			...options,
			score: clapCount,
			emoji_code: '👏'
		}
	);
}

/**
 * Gets reaction groups (aggregated reactions) for a message
 * This provides counts and scores for each reaction type
 * 
 * @param contentId - Content identifier
 * @param messageId - Message to get reaction groups for
 * @returns Promise<Record<string, ReactionGroup>> - Reaction groups by type
 * @throws Error if query fails
 */
export async function getReactionGroups(
	contentId: string,
	messageId: string
): Promise<Record<string, ReactionGroup>> {
	if (!contentId || !messageId) {
		throw new Error('Content ID and Message ID are required');
	}

	try {
		// Get the message to access its reaction_groups
		const message = await serverClient.getMessage(messageId);
		
		if (!message.message.reaction_groups) {
			return {};
		}

		const groups: Record<string, ReactionGroup> = {};
		
		for (const [type, group] of Object.entries(message.message.reaction_groups)) {
			const groupData = group as any;
			groups[type] = {
				type,
				count: groupData.count || 0,
				sum_scores: groupData.sum_scores || 0,
				first_reaction_at: groupData.first_reaction_at,
				last_reaction_at: groupData.last_reaction_at
			};
		}

		return groups;
	} catch (error) {
		console.error('Failed to get reaction groups:', error);
		throw new Error('Failed to get reaction groups');
	}
}

/**
 * Gets the top reactions for a message (most popular)
 * 
 * @param contentId - Content identifier
 * @param messageId - Message to get top reactions for
 * @param limit - Maximum number of reaction types to return
 * @returns Promise<ReactionGroup[]> - Top reactions sorted by count
 * @throws Error if query fails
 */
export async function getTopReactions(
	contentId: string,
	messageId: string,
	limit: number = 5
): Promise<ReactionGroup[]> {
	const reactionGroups = await getReactionGroups(contentId, messageId);
	
	return Object.values(reactionGroups)
		.sort((a, b) => b.count - a.count)
		.slice(0, limit);
}

/**
 * Checks if a user has reacted to a message with a specific reaction type
 * 
 * @param contentId - Content identifier
 * @param messageId - Message to check
 * @param userId - User to check for
 * @param reactionType - Type of reaction to check
 * @returns Promise<boolean> - True if user has this reaction on the message
 * @throws Error if check fails
 */
export async function hasUserReacted(
	contentId: string,
	messageId: string,
	userId: string,
	reactionType: string
): Promise<boolean> {
	try {
		const reactions = await getMessageReactions(contentId, messageId, {
			user_id: userId,
			type: reactionType,
			limit: 1
		});

		return reactions.length > 0;
	} catch (error) {
		console.error('Failed to check user reaction:', error);
		return false;
	}
}

/**
 * Gets all reaction types a user has made on a message
 * 
 * @param contentId - Content identifier
 * @param messageId - Message to check
 * @param userId - User to get reactions for
 * @returns Promise<string[]> - Array of reaction types the user has made
 * @throws Error if query fails
 */
export async function getUserReactionTypes(
	contentId: string,
	messageId: string,
	userId: string
): Promise<string[]> {
	try {
		const reactions = await getMessageReactions(contentId, messageId, {
			user_id: userId,
			limit: 50 // Should be enough for most use cases
		});

		return reactions.map(reaction => reaction.type);
	} catch (error) {
		console.error('Failed to get user reaction types:', error);
		return [];
	}
}

/**
 * Formats a raw Stream reaction response into our standardized format
 * 
 * @param reaction - Raw reaction from Stream API
 * @param messageId - Message ID the reaction belongs to
 * @returns FormattedReaction - Formatted reaction object
 */
function formatReaction(reaction: any, messageId: string): FormattedReaction {
	return {
		type: reaction.type,
		score: reaction.score || 1,
		user: {
			id: reaction.user?.id || reaction.user_id || '',
			name: reaction.user?.name || '',
			image: reaction.user?.image
		},
		created_at: reaction.created_at,
		message_id: messageId,
		custom_data: extractReactionCustomData(reaction)
	};
}

/**
 * Extracts custom data from a reaction, excluding standard fields
 * 
 * @param reaction - Raw reaction object
 * @returns Record<string, any> | undefined - Custom data fields
 */
function extractReactionCustomData(reaction: any): Record<string, any> | undefined {
	const standardFields = new Set([
		'type', 'score', 'user', 'user_id', 'created_at', 'updated_at', 'message_id'
	]);

	const customData: Record<string, any> = {};
	for (const [key, value] of Object.entries(reaction)) {
		if (!standardFields.has(key)) {
			customData[key] = value;
		}
	}

	return Object.keys(customData).length > 0 ? customData : undefined;
}
