import { StreamChat } from 'stream-chat';
import { env } from '$env/dynamic/private';

/**
 * Server-side Stream Chat Configuration
 *
 * This module handles server-side Stream Chat operations and should only be imported
 * in server-side code (API routes, server hooks, etc.)
 */

// Environment variables for Stream Chat (server-side only)
const STREAM_API_KEY = env.STREAM_API_KEY;
const STREAM_API_SECRET = env.STREAM_API_SECRET;

if (!STREAM_API_KEY) {
	throw new Error('STREAM_API_KEY environment variable is required');
}

if (!STREAM_API_SECRET) {
	throw new Error('STREAM_API_SECRET environment variable is required');
}

/**
 * Server-side Stream Chat client
 * Used for server-side operations like token generation, channel management, etc.
 * This client has administrative privileges and should only be used server-side.
 */
export const serverClient = StreamChat.getInstance(STREAM_API_KEY, STREAM_API_SECRET);

/**
 * Server-side configuration constants
 */
export const SERVER_CONFIG = {
	API_KEY: STREAM_API_KEY,
	API_SECRET: STREAM_API_SECRET,

	// Token expiration time (7 days in seconds)
	TOKEN_EXPIRATION: 604800
} as const;

/**
 * Stream Chat configuration constants (server-side)
 * This mirrors the client-side config but is safe for server use
 */
export const STREAM_CONFIG = {
	// Channel types for different use cases
	CHANNEL_TYPES: {
		COMMENTS: 'gaming', // For video/content comments - more permissive than messaging
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
