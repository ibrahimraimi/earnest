/**
 * Stream Chat Server-Side Integration Module
 *
 * This module exports server-side only functions and should only be imported
 * in server-side code (API routes, server hooks, etc.)
 *
 * Usage:
 * import { serverClient, createUserToken, sendComment } from '$lib/stream/server-index.js';
 */

// Server-side configuration
export * from './server-config.js';

// Server-side authentication functions
export { createUserToken, refreshUserToken, revokeUserToken } from './auth.js';

// Server-side channel management functions
export {
	createCommentChannel,
	watchCommentChannel,
	stopWatchingChannel,
	queryCommentChannels,
	getChannelInfo,
	addChannelMember,
	removeChannelMember
} from './channels.js';

// Server-side message management functions
export {
	sendComment,
	getComments,
	getCommentsWithFallback,
	getMessage,
	updateMessage,
	partialUpdateMessage,
	deleteMessage,
	undeleteMessage,
	getReplies
} from './messages.js';

// Server-side reaction management functions
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

// Server-side file upload functions
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

// Server-side type exports
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
