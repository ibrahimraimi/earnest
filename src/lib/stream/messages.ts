import { serverClient, STREAM_CONFIG } from './server-config.js';
import { clientStreamInstance } from './config.js';
import type { Channel, MessageResponse, UserResponse } from 'stream-chat';

/**
 * Stream Chat Message Management Module
 *
 * This module handles all message operations for the comment system.
 * It provides functions for sending, updating, deleting, and querying messages
 * in comment channels.
 */

/**
 * Interface for message creation options
 */
export interface CreateMessageOptions {
	text: string;
	attachments?: MessageAttachment[];
	mentioned_users?: string[];
	parent_id?: string; // For reply messages
	custom_data?: Record<string, any>;
	skip_push?: boolean;
	restricted_visibility?: string[]; // User IDs who can see this message
}

/**
 * Interface for message attachments
 */
export interface MessageAttachment {
	type: 'image' | 'video' | 'audio' | 'file' | 'url';
	asset_url?: string;
	thumb_url?: string;
	title?: string;
	text?: string;
	author_name?: string;
	title_link?: string;
	image_url?: string;
	file_size?: number;
	mime_type?: string;
	custom_data?: Record<string, any>;
}

/**
 * Interface for message query options
 */
export interface MessageQueryOptions {
	limit?: number;
	offset?: number;
	sort?: Record<string, number>[];
	created_at_after?: string;
	created_at_before?: string;
	user_id?: string;
	include_deleted?: boolean;
}

/**
 * Interface for message update options
 */
export interface UpdateMessageOptions {
	text?: string;
	attachments?: MessageAttachment[];
	custom_data?: Record<string, any>;
}

/**
 * Interface for formatted message response
 */
export interface FormattedMessage {
	id: string;
	text: string;
	html?: string;
	type: string;
	user: {
		id: string;
		name: string;
		image?: string;
		role?: string;
		online?: boolean;
	};
	attachments: MessageAttachment[];
	mentioned_users: UserResponse[];
	latest_reactions: any[];
	own_reactions: any[];
	reaction_groups: Record<string, any>;
	reply_count: number;
	parent_id?: string;
	created_at: string;
	updated_at: string;
	deleted_at?: string;
	custom_data?: Record<string, any>;
}

/**
 * Sends a comment message to a content channel
 *
 * @param contentId - Content identifier (video ID, post ID, etc.)
 * @param userId - User sending the message
 * @param options - Message options including text, attachments, etc.
 * @returns Promise<FormattedMessage> - The created message
 * @throws Error if message sending fails
 */
export async function sendComment(
	contentId: string,
	userId: string,
	options: CreateMessageOptions,
	pb?: any
): Promise<FormattedMessage> {
	if (!contentId || !userId || !options.text?.trim()) {
		throw new Error('Content ID, User ID, and message text are required');
	}

	try {
		const channelId = `comments_${contentId}`;

		// Get channel instance (server-side for sending messages on behalf of users)
		const channel = serverClient.channel(STREAM_CONFIG.CHANNEL_TYPES.COMMENTS, channelId);

		// Ensure channel is initialized and watched
		try {
			await channel.watch();
		} catch (watchError) {
			// If watching fails, try to create the channel
			await channel.create({
				created_by_id: userId,
				members: [userId]
			});
		}

		// Prepare message data
		const messageData: any = {
			text: options.text.trim(),
			user_id: userId, // Required for server-side message sending
			type: STREAM_CONFIG.MESSAGE_TYPES.REGULAR
		};

		// Add optional fields
		if (options.attachments?.length) {
			messageData.attachments = options.attachments;
		}

		if (options.mentioned_users?.length) {
			messageData.mentioned_users = options.mentioned_users.slice(0, 25); // Max 25
		}

		if (options.parent_id) {
			messageData.parent_id = options.parent_id;
		}

		if (options.custom_data) {
			Object.assign(messageData, options.custom_data);
		}

		// Send options
		const sendOptions: any = {};
		if (options.skip_push) {
			sendOptions.skip_push = true;
		}

		if (options.restricted_visibility?.length) {
			sendOptions.restricted_visibility = options.restricted_visibility;
		}

		// Send the message to Stream Chat
		const response = await channel.sendMessage(messageData, sendOptions);

		const formattedMessage = formatMessage(response.message);

		// Also save to PocketBase if pb instance is provided
		if (pb) {
			try {
				// Start with minimal required fields
				const commentData: any = {
					content_id: [contentId], // Fix: Send as array
					user_id: [userId], // Fix: Send as array
					channel_id: channelId,
					text: formattedMessage.text
				};

				// Add optional fields only if they exist
				if (options.parent_id) {
					commentData.parent_id = options.parent_id;
				}

				// Convert complex objects to JSON strings for PocketBase
				if (options.attachments && options.attachments.length > 0) {
					commentData.attachments = JSON.stringify(options.attachments);
				}

				if (options.mentioned_users && options.mentioned_users.length > 0) {
					commentData.mentioned_users = JSON.stringify(options.mentioned_users);
				}

				if (options.custom_data && Object.keys(options.custom_data).length > 0) {
					commentData.custom_data = JSON.stringify(options.custom_data);
				}

				// Try to create the comment
				try {
					const savedComment = await pb.collection('comments').create(commentData);
				} catch (createError: any) {
					// Try without channel_id (might not be required)
					const commentDataWithoutChannel = {
						content_id: [contentId],
						user_id: [userId],
						text: formattedMessage.text
					};

					try {
						await pb.collection('comments').create(commentDataWithoutChannel);
					} catch (secondError: any) {
						// Try with just text (absolute minimum)
						const minimalData = {
							text: formattedMessage.text
						};

						try {
							await pb.collection('comments').create(minimalData);
						} catch (thirdError: any) {
							// All attempts failed, but don't break the main flow
						}
					}
				}
			} catch (pbError: any) {
				// Don't fail the entire operation if PocketBase save fails
			}
		}

		return formattedMessage;
	} catch (error: any) {
		console.error('Failed to send comment:', error);
		console.error('Error details:', {
			message: error.message,
			status: error.status,
			code: error.code,
			response: error.response?.data
		});
		throw new Error(`Failed to send comment: ${error.message || 'Unknown error'}`);
	}
}

/**
 * Gets messages from a comment channel
 *
 * @param contentId - Content identifier
 * @param options - Query options for filtering and pagination
 * @returns Promise<FormattedMessage[]> - Array of messages
 * @throws Error if query fails
 */
export async function getComments(
	contentId: string,
	options: MessageQueryOptions = {}
): Promise<FormattedMessage[]> {
	if (!contentId) {
		throw new Error('Content ID is required');
	}

	try {
		const channelId = `comments_${contentId}`;

		// Get channel instance
		const channel = clientStreamInstance.channel(STREAM_CONFIG.CHANNEL_TYPES.COMMENTS, channelId);

		// Prepare query options
		const queryOptions: any = {
			limit: Math.min(options.limit || 25, 300), // Max 300
			offset: Math.min(options.offset || 0, 10000) // Max 10000
		};

		if (options.created_at_after) {
			queryOptions.created_at_after = options.created_at_after;
		}

		if (options.created_at_before) {
			queryOptions.created_at_before = options.created_at_before;
		}

		if (options.user_id) {
			queryOptions.user_id = options.user_id;
		}

		if (options.include_deleted) {
			queryOptions.include_deleted = true;
		}

		// Query messages
		const response = await channel.query({
			messages: queryOptions
		});

		// Format and return messages
		return (response.messages || []).map(formatMessage);
	} catch (error) {
		console.error('Failed to get comments:', error);
		throw new Error('Failed to get comments');
	}
}

/**
 * Gets messages from a comment channel with PocketBase fallback
 *
 * @param contentId - Content identifier
 * @param options - Query options for filtering and pagination
 * @param pb - PocketBase instance for fallback loading
 * @returns Promise<FormattedMessage[]> - Array of messages
 * @throws Error if query fails
 */
export async function getCommentsWithFallback(
	contentId: string,
	options: MessageQueryOptions = {},
	pb?: any
): Promise<FormattedMessage[]> {
	if (!contentId) {
		throw new Error('Content ID is required');
	}

	try {
		// Try to get comments from Stream Chat first
		const messages = await getComments(contentId, options);
		return messages;
	} catch (streamError) {
		console.warn(
			'Failed to get comments from Stream Chat, trying PocketBase fallback:',
			streamError
		);

		// Fallback to PocketBase if Stream Chat fails
		if (pb) {
			try {
				const comments = await pb.collection('comments').getList(1, options.limit || 25, {
					filter: `content_id = "${contentId}"`,
					sort: '-created'
				});

				// Convert PocketBase comments to FormattedMessage format
				return comments.items.map((comment: any) => ({
					id: comment.message_id || comment.id,
					text: comment.text,
					html: comment.text,
					type: 'regular',
					user: {
						id: comment.user_id,
						name: `User ${comment.user_id}`, // You might want to fetch user details separately
						image: undefined,
						role: undefined,
						online: false
					},
					attachments: comment.attachments || [],
					mentioned_users: comment.mentioned_users || [],
					latest_reactions: [],
					own_reactions: [],
					reaction_groups: {},
					reply_count: 0,
					parent_id: comment.parent_id,
					created_at: comment.created,
					updated_at: comment.updated,
					deleted_at: undefined,
					custom_data: comment.custom_data || {}
				}));
			} catch (pbError) {
				console.error('Failed to get comments from PocketBase fallback:', pbError);
				throw new Error('Failed to get comments from both Stream Chat and PocketBase');
			}
		}

		throw streamError;
	}
}

/**
 * Gets a specific message by ID
 *
 * @param messageId - Message identifier
 * @param showDeleted - Whether to show deleted messages (server-side only)
 * @returns Promise<FormattedMessage | null> - The message or null if not found
 * @throws Error if query fails
 */
export async function getMessage(
	messageId: string,
	showDeleted: boolean = false
): Promise<FormattedMessage | null> {
	if (!messageId) {
		throw new Error('Message ID is required');
	}

	try {
		const options: any = {};
		if (showDeleted) {
			options.show_deleted_message = true;
		}

		const response = await serverClient.getMessage(messageId, options);
		return formatMessage(response.message);
	} catch (error) {
		console.error('Failed to get message:', error);
		return null;
	}
}

/**
 * Updates a message
 *
 * @param messageId - Message identifier
 * @param userId - User updating the message (must be message author or admin)
 * @param options - Update options
 * @returns Promise<FormattedMessage> - The updated message
 * @throws Error if update fails
 */
export async function updateMessage(
	messageId: string,
	userId: string,
	options: UpdateMessageOptions,
	pb?: any
): Promise<FormattedMessage> {
	if (!messageId || !userId) {
		throw new Error('Message ID and User ID are required');
	}

	if (!options.text && !options.attachments && !options.custom_data) {
		throw new Error('At least one field to update is required');
	}

	try {
		const updateData: any = { id: messageId };

		if (options.text !== undefined) {
			updateData.text = options.text.trim();
		}

		if (options.attachments) {
			updateData.attachments = options.attachments;
		}

		if (options.custom_data) {
			Object.assign(updateData, options.custom_data);
		}

		const response = await serverClient.updateMessage(updateData, userId);
		const formattedMessage = formatMessage(response.message);

		// Also update PocketBase if pb instance is provided
		if (pb) {
			try {
				// Find and update the comment record
				const comments = await pb.collection('comments').getList(1, 1, {
					filter: `message_id = "${messageId}"`
				});

				if (comments.items.length > 0) {
					const updateData = {
						text: formattedMessage.text,
						attachments: formattedMessage.attachments,
						custom_data: formattedMessage.custom_data,
						updated: new Date().toISOString()
					};

					await pb.collection('comments').update(comments.items[0].id, updateData);
				}
			} catch (pbError) {
				// Don't fail the entire operation if PocketBase update fails
			}
		}

		return formattedMessage;
	} catch (error) {
		console.error('Failed to update message:', error);
		throw new Error('Failed to update message');
	}
}

/**
 * Partially updates a message (patch-style update)
 *
 * @param messageId - Message identifier
 * @param userId - User updating the message
 * @param updates - Object with 'set' and/or 'unset' operations
 * @returns Promise<FormattedMessage> - The updated message
 * @throws Error if update fails
 */
export async function partialUpdateMessage(
	messageId: string,
	userId: string,
	updates: {
		set?: Record<string, any>;
		unset?: string[];
	}
): Promise<FormattedMessage> {
	if (!messageId || !userId) {
		throw new Error('Message ID and User ID are required');
	}

	if (!updates.set && !updates.unset) {
		throw new Error('Set or unset operations are required');
	}

	try {
		const response = await serverClient.partialUpdateMessage(messageId, updates as any, userId);
		return formatMessage(response.message);
	} catch (error) {
		console.error('Failed to partially update message:', error);
		throw new Error('Failed to update message');
	}
}

/**
 * Deletes a message
 *
 * @param messageId - Message identifier
 * @param userId - User deleting the message (must be message author or admin)
 * @param hard - Whether to hard delete (permanent) or soft delete
 * @returns Promise<FormattedMessage> - The deleted message
 * @throws Error if deletion fails
 */
export async function deleteMessage(
	messageId: string,
	userId: string,
	hard: boolean = false,
	pb?: any
): Promise<FormattedMessage> {
	if (!messageId || !userId) {
		throw new Error('Message ID and User ID are required');
	}

	try {
		const response = await serverClient.deleteMessage(messageId, hard);
		const formattedMessage = formatMessage(response.message);

		// Also remove from PocketBase if pb instance is provided
		if (pb) {
			try {
				// Find and delete the comment record
				const comments = await pb.collection('comments').getList(1, 1, {
					filter: `message_id = "${messageId}"`
				});

				if (comments.items.length > 0) {
					await pb.collection('comments').delete(comments.items[0].id);
				}
			} catch (pbError) {
				// Don't fail the entire operation if PocketBase deletion fails
			}
		}

		return formattedMessage;
	} catch (error) {
		console.error('Failed to delete message:', error);
		throw new Error('Failed to delete message');
	}
}

/**
 * Undeletes a soft-deleted message (server-side only)
 *
 * @param messageId - Message identifier
 * @param userId - User undeleting the message
 * @returns Promise<FormattedMessage> - The undeleted message
 * @throws Error if undeletion fails
 */
export async function undeleteMessage(
	messageId: string,
	userId: string
): Promise<FormattedMessage> {
	if (!messageId || !userId) {
		throw new Error('Message ID and User ID are required');
	}

	try {
		const response = await serverClient.undeleteMessage(messageId, userId);
		return formatMessage(response.message);
	} catch (error) {
		console.error('Failed to undelete message:', error);
		throw new Error('Failed to undelete message');
	}
}

/**
 * Gets replies to a message
 *
 * @param parentMessageId - Parent message identifier
 * @param options - Query options
 * @returns Promise<FormattedMessage[]> - Array of reply messages
 * @throws Error if query fails
 */
export async function getReplies(
	parentMessageId: string,
	options: MessageQueryOptions = {}
): Promise<FormattedMessage[]> {
	if (!parentMessageId) {
		throw new Error('Parent message ID is required');
	}

	try {
		// Note: getReplies is not available on serverClient, using getMessage instead
		const parentMessage = await serverClient.getMessage(parentMessageId);

		// For now, return empty array as Stream doesn't have a direct getReplies on server client
		// In a real implementation, you would query messages with parent_id filter
		console.warn('getReplies not implemented on server client, returning empty array');
		return [];
	} catch (error) {
		console.error('Failed to get replies:', error);
		throw new Error('Failed to get replies');
	}
}

/**
 * Formats a raw Stream message response into our standardized format
 *
 * @param message - Raw message from Stream API
 * @returns FormattedMessage - Formatted message object
 */
function formatMessage(message: MessageResponse): FormattedMessage {
	return {
		id: message.id,
		text: message.text || '',
		html: message.html,
		type: message.type || STREAM_CONFIG.MESSAGE_TYPES.REGULAR,
		user: {
			id: message.user?.id || '',
			name: message.user?.name || '',
			image: message.user?.image,
			role: message.user?.role,
			online: message.user?.online
		},
		attachments: (message.attachments || []) as MessageAttachment[],
		mentioned_users: message.mentioned_users || [],
		latest_reactions: message.latest_reactions || [],
		own_reactions: message.own_reactions || [],
		reaction_groups: message.reaction_groups || {},
		reply_count: message.reply_count || 0,
		parent_id: message.parent_id,
		created_at: message.created_at || new Date().toISOString(),
		updated_at: message.updated_at || new Date().toISOString(),
		deleted_at: message.deleted_at,
		custom_data: extractCustomData(message) || {}
	};
}

/**
 * Extracts custom data from a message, excluding standard fields
 *
 * @param message - Raw message object
 * @returns Record<string, any> - Custom data fields
 */
function extractCustomData(message: any): Record<string, any> {
	const standardFields = new Set([
		'id',
		'text',
		'html',
		'type',
		'user',
		'attachments',
		'mentioned_users',
		'latest_reactions',
		'own_reactions',
		'reaction_groups',
		'reply_count',
		'parent_id',
		'created_at',
		'updated_at',
		'deleted_at',
		'cid',
		'command',
		'command_info',
		'i18n',
		'pin_expires',
		'pinned',
		'pinned_at',
		'pinned_by',
		'shadowed',
		'show_in_channel',
		'silent',
		'thread_participants'
	]);

	const customData: Record<string, any> = {};
	for (const [key, value] of Object.entries(message)) {
		if (!standardFields.has(key)) {
			customData[key] = value;
		}
	}

	return Object.keys(customData).length > 0 ? customData : {};
}
