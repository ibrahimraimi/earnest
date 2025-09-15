import { StreamChat } from 'stream-chat';

/**
 * Stream Chat Configuration
 *
 * This module handles the initialization and configuration of Stream Chat clients.
 * It provides both client-side and server-side instances for different use cases.
 */

/**
 * Client-side Stream Chat instance
 * Used for user-facing operations after connecting with user token
 * This client operates with user-level permissions.
 *
 * Note: API key is safe to expose on client-side
 */
export const clientStreamInstance = StreamChat.getInstance(
	typeof window !== 'undefined' ? import.meta.env.VITE_STREAM_API_KEY || '' : ''
);

/**
 * Stream Chat configuration constants
 */
export const STREAM_CONFIG = {
	// Channel types for different use cases
	CHANNEL_TYPES: {
		COMMENTS: 'messaging', // For video/content comments
		LIVESTREAM: 'livestream', // For live streaming
		TEAM: 'team', // For team communications
		GAMING: 'gaming', // For gaming communications
		COMMERCE: 'commerce' // For commerce communications
	},

	// Message types
	MESSAGE_TYPES: {
		REGULAR: 'regular',
		EPHEMERAL: 'ephemeral',
		ERROR: 'error',
		REPLY: 'reply',
		SYSTEM: 'system',
		DELETED: 'deleted'
	},

	// Attachment types
	ATTACHMENT_TYPES: {
		IMAGE: 'image',
		VIDEO: 'video',
		AUDIO: 'audio',
		FILE: 'file',
		URL: 'url'
	}
} as const;

/**
 * Type definitions for Stream Chat operations
 */
export type ChannelType = keyof typeof STREAM_CONFIG.CHANNEL_TYPES;
export type MessageType = keyof typeof STREAM_CONFIG.MESSAGE_TYPES;
export type AttachmentType = keyof typeof STREAM_CONFIG.ATTACHMENT_TYPES;
