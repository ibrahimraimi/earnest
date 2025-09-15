import { serverClient, STREAM_CONFIG } from './server-config.js';
import { clientStreamInstance } from './config.js';

/**
 * Stream Chat File Upload Management Module
 * 
 * This module handles file uploads for the comment system.
 * It provides functions for uploading images, videos, and other files
 * to be used as attachments in messages.
 */

/**
 * Interface for upload response
 */
export interface UploadResponse {
	file: string; // URL to the uploaded file
	thumb_url?: string; // Thumbnail URL (for images)
}

/**
 * Interface for upload options
 */
export interface UploadOptions {
	user_id?: string; // Required for server-side uploads
	progress_callback?: (progress: number) => void;
}

/**
 * Interface for supported file types
 */
export interface FileTypeConfig {
	images: string[];
	videos: string[];
	audio: string[];
	documents: string[];
	maxSize: number; // In bytes
}

/**
 * Supported file types and configurations
 */
export const FILE_CONFIG: FileTypeConfig = {
	// Supported image types
	images: [
		'image/bmp',
		'image/gif', 
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/heic',
		'image/heic-sequence',
		'image/heif',
		'image/heif-sequence',
		'image/svg+xml'
	],
	
	// Supported video types
	videos: [
		'video/mp4',
		'video/webm',
		'video/ogg',
		'video/avi',
		'video/mov',
		'video/wmv',
		'video/flv',
		'video/3gp'
	],
	
	// Supported audio types
	audio: [
		'audio/mp3',
		'audio/wav',
		'audio/ogg',
		'audio/aac',
		'audio/flac',
		'audio/m4a'
	],
	
	// Supported document types
	documents: [
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'text/plain',
		'text/csv'
	],
	
	// Maximum file size: 100MB
	maxSize: 100 * 1024 * 1024
};

/**
 * Interface for resizing options
 */
export interface ResizeOptions {
	width?: number;
	height?: number;
	resize?: 'clip' | 'crop' | 'scale' | 'fill';
	crop?: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Uploads an image file to Stream CDN
 * 
 * @param contentId - Content identifier (for channel context)
 * @param file - File object or Buffer to upload
 * @param userId - User uploading the file (required for server-side)
 * @param options - Upload options
 * @returns Promise<UploadResponse> - Upload response with URLs
 * @throws Error if upload fails
 */
export async function uploadImage(
	contentId: string,
	file: File | Buffer,
	userId: string,
	options: UploadOptions = {}
): Promise<UploadResponse> {
	if (!contentId || !file || !userId) {
		throw new Error('Content ID, file, and User ID are required');
	}

	// Validate file type for images
	if (file instanceof File) {
		if (!FILE_CONFIG.images.includes(file.type)) {
			throw new Error(`Unsupported image type: ${file.type}`);
		}
		
		if (file.size > FILE_CONFIG.maxSize) {
			throw new Error(`File size exceeds maximum allowed size of ${FILE_CONFIG.maxSize / (1024 * 1024)}MB`);
		}
	}

	try {
		const channelId = `comments_${contentId}`;
		
		// Get channel instance
		const channel = serverClient.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId
		);

		// Upload the image
		const response = await channel.sendImage(file as File);

		return {
			file: response.file,
			thumb_url: response.thumb_url
		};
	} catch (error) {
		console.error('Failed to upload image:', error);
		throw new Error('Failed to upload image');
	}
}

/**
 * Uploads a file (non-image) to Stream CDN
 * 
 * @param contentId - Content identifier (for channel context)
 * @param file - File object or Buffer to upload
 * @param userId - User uploading the file (required for server-side)
 * @param options - Upload options
 * @returns Promise<UploadResponse> - Upload response with URL
 * @throws Error if upload fails
 */
export async function uploadFile(
	contentId: string,
	file: File | Buffer,
	userId: string,
	options: UploadOptions = {}
): Promise<UploadResponse> {
	if (!contentId || !file || !userId) {
		throw new Error('Content ID, file, and User ID are required');
	}

	// Validate file size
	const fileSize = file instanceof File ? file.size : file.length;
	if (fileSize > FILE_CONFIG.maxSize) {
	  throw new Error(`File size exceeds maximum allowed size of ${FILE_CONFIG.maxSize / (1024 * 1024)}MB`);
	}

	try {
		const channelId = `comments_${contentId}`;
		
		// Get channel instance
		const channel = serverClient.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId
		);

		// Upload the file
		const response = await channel.sendFile(file as File);

		return {
			file: response.file
		};
	} catch (error) {
		console.error('Failed to upload file:', error);
		throw new Error('Failed to upload file');
	}
}

/**
 * Deletes an uploaded image from Stream CDN
 * 
 * @param contentId - Content identifier (for channel context)
 * @param imageUrl - URL of the image to delete
 * @param userId - User deleting the image
 * @returns Promise<void>
 * @throws Error if deletion fails
 */
export async function deleteImage(
	contentId: string,
	imageUrl: string,
	userId: string
): Promise<void> {
	if (!contentId || !imageUrl || !userId) {
		throw new Error('Content ID, image URL, and User ID are required');
	}

	try {
		const channelId = `comments_${contentId}`;
		
		// Get channel instance
		const channel = serverClient.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId
		);

		// Delete the image
		await channel.deleteImage(imageUrl);
	} catch (error) {
		console.error('Failed to delete image:', error);
		throw new Error('Failed to delete image');
	}
}

/**
 * Deletes an uploaded file from Stream CDN
 * 
 * @param contentId - Content identifier (for channel context)
 * @param fileUrl - URL of the file to delete
 * @param userId - User deleting the file
 * @returns Promise<void>
 * @throws Error if deletion fails
 */
export async function deleteFile(
	contentId: string,
	fileUrl: string,
	userId: string
): Promise<void> {
	if (!contentId || !fileUrl || !userId) {
		throw new Error('Content ID, file URL, and User ID are required');
	}

	try {
		const channelId = `comments_${contentId}`;
		
		// Get channel instance
		const channel = serverClient.channel(
			STREAM_CONFIG.CHANNEL_TYPES.COMMENTS,
			channelId
		);

		// Delete the file
		await channel.deleteFile(fileUrl);
	} catch (error) {
		console.error('Failed to delete file:', error);
		throw new Error('Failed to delete file');
	}
}

/**
 * Generates a resized image URL with query parameters
 * 
 * Note: Only works with images stored on Stream CDN
 * Image must have total pixel count of 16,800,000 or less
 * 
 * @param imageUrl - Original Stream CDN image URL
 * @param options - Resize options
 * @returns string - Resized image URL with query parameters
 * @throws Error if URL is invalid or options are invalid
 */
export function getResizedImageUrl(
	imageUrl: string,
	options: ResizeOptions
): string {
	if (!imageUrl || !imageUrl.includes('stream-io-cdn.com')) {
		throw new Error('Invalid Stream CDN image URL');
	}

	if (!options.width && !options.height) {
		throw new Error('Width or height must be specified for resizing');
	}

	try {
		const url = new URL(imageUrl);
		
		// Add resize parameters
		if (options.width) {
			url.searchParams.set('w', options.width.toString());
		}
		
		if (options.height) {
			url.searchParams.set('h', options.height.toString());
		}
		
		if (options.resize) {
			url.searchParams.set('resize', options.resize);
		}
		
		if (options.crop) {
			url.searchParams.set('crop', options.crop);
		}

		return url.toString();
	} catch (error) {
		console.error('Failed to generate resized image URL:', error);
		throw new Error('Failed to generate resized image URL');
	}
}

/**
 * Validates if a file type is supported
 * 
 * @param mimeType - MIME type of the file
 * @returns object - Validation result with type category and support status
 */
export function validateFileType(mimeType: string): {
	supported: boolean;
	category: 'image' | 'video' | 'audio' | 'document' | 'unknown';
	mime_type: string;
} {
	if (FILE_CONFIG.images.includes(mimeType)) {
		return {
			supported: true,
			category: 'image',
			mime_type: mimeType
		};
	} else if (FILE_CONFIG.videos.includes(mimeType)) {
		return {
			supported: true,
			category: 'video',
			mime_type: mimeType
		};
	} else if (FILE_CONFIG.audio.includes(mimeType)) {
		return {
			supported: true,
			category: 'audio',
			mime_type: mimeType
		};
	} else if (FILE_CONFIG.documents.includes(mimeType)) {
		return {
			supported: true,
			category: 'document',
			mime_type: mimeType
		};
	}

	return {
		supported: false,
		category: 'unknown',
		mime_type: mimeType
	};
}

/**
 * Validates file size
 * 
 * @param fileSize - Size of the file in bytes
 * @returns object - Validation result
 */
export function validateFileSize(fileSize: number): {
	valid: boolean;
	size: number;
	maxSize: number;
	message?: string;
} {
	const valid = fileSize <= FILE_CONFIG.maxSize;
	
	return {
		valid,
		size: fileSize,
		maxSize: FILE_CONFIG.maxSize,
		message: valid ? undefined : `File size ${(fileSize / (1024 * 1024)).toFixed(2)}MB exceeds maximum allowed size of ${FILE_CONFIG.maxSize / (1024 * 1024)}MB`
	};
}

/**
 * Gets file information from a Stream CDN URL
 * 
 * @param fileUrl - Stream CDN file URL
 * @returns object - File information including expiration
 */
export function getFileInfo(fileUrl: string): {
	isStreamCDN: boolean;
	expiresAt?: Date;
	isExpired?: boolean;
	timeUntilExpiry?: number; // milliseconds
} {
	const result = {
		isStreamCDN: false,
		expiresAt: undefined as Date | undefined,
		isExpired: undefined as boolean | undefined,
		timeUntilExpiry: undefined as number | undefined
	};

	if (!fileUrl.includes('stream-io-cdn.com')) {
		return result;
	}

	result.isStreamCDN = true;

	try {
		const url = new URL(fileUrl);
		const expires = url.searchParams.get('Expires');
		
		if (expires) {
			const expiresTimestamp = parseInt(expires) * 1000; // Convert to milliseconds
			result.expiresAt = new Date(expiresTimestamp);
			result.isExpired = Date.now() > expiresTimestamp;
			result.timeUntilExpiry = expiresTimestamp - Date.now();
		}
	} catch (error) {
		console.error('Failed to parse file URL:', error);
	}

	return result;
}

/**
 * Creates a file attachment object for use in messages
 * 
 * @param fileUrl - URL of the uploaded file
 * @param fileType - Type of the file
 * @param fileName - Name of the file
 * @param fileSize - Size of the file in bytes
 * @param thumbUrl - Thumbnail URL (for images/videos)
 * @returns object - Attachment object for message
 */
export function createFileAttachment(
	fileUrl: string,
	fileType: string,
	fileName?: string,
	fileSize?: number,
	thumbUrl?: string
): {
	type: string;
	asset_url: string;
	title?: string;
	file_size?: number;
	mime_type: string;
	thumb_url?: string;
} {
	const validation = validateFileType(fileType);
	
	return {
		type: validation.category,
		asset_url: fileUrl,
		title: fileName,
		file_size: fileSize,
		mime_type: fileType,
		thumb_url: thumbUrl
	};
}
