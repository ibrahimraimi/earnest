/**
 * Stream Chat Integration Module
 *
 * This is the main entry point for all Stream Chat functionality.
 * It exports all the necessary functions and types for building
 * a YouTube/Instagram-like comment system.
 *
 * Usage:
 * import { StreamAuth, StreamChannels, StreamMessages, StreamReactions, StreamUploads } from '$lib/stream';
 *
 * Or import specific functions:
 * import { createUserToken, sendComment, addReaction } from '$lib/stream';
 */

// Configuration and types (client-side safe)
export * from './config.js';

// Authentication functions
export * as StreamAuth from './auth.js';
export {
	createUserToken,
	refreshUserToken,
	revokeUserToken,
	connectUser,
	disconnectUser,
	isUserConnected,
	getCurrentUser
} from './auth.js';

// Channel management functions
export * as StreamChannels from './channels.js';
export {
	createCommentChannel,
	watchCommentChannel,
	stopWatchingChannel,
	queryCommentChannels,
	getChannelInfo,
	addChannelMember,
	removeChannelMember
} from './channels.js';

// Message management functions
export * as StreamMessages from './messages.js';
export {
	sendComment,
	getComments,
	getMessage,
	updateMessage,
	partialUpdateMessage,
	deleteMessage,
	undeleteMessage,
	getReplies
} from './messages.js';

// Reaction management functions
export * as StreamReactions from './reactions.js';
export {
	addReaction,
	removeReaction,
	getMessageReactions,
	queryReactions,
	addClapReaction,
	getReactionGroups,
	getTopReactions,
	hasUserReacted,
	getUserReactionTypes,
	REACTION_TYPES
} from './reactions.js';

// File upload functions
export * as StreamUploads from './uploads.js';
export {
	uploadImage,
	uploadFile,
	deleteImage,
	deleteFile,
	getResizedImageUrl,
	validateFileType,
	validateFileSize,
	getFileInfo,
	createFileAttachment,
	FILE_CONFIG
} from './uploads.js';

// Type exports for external use
export type { StreamUser, TokenResponse } from './auth.js';

export type { ChannelCreateOptions, ChannelQueryOptions, ChannelResponse } from './channels.js';

export type {
	CreateMessageOptions,
	MessageAttachment,
	MessageQueryOptions,
	UpdateMessageOptions,
	FormattedMessage
} from './messages.js';

export type {
	MessageReaction,
	ReactionOptions,
	ReactionQueryOptions,
	ReactionPaginationOptions,
	ReactionGroup,
	FormattedReaction
} from './reactions.js';

export type { UploadResponse, UploadOptions, FileTypeConfig, ResizeOptions } from './uploads.js';
