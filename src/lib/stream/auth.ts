import { serverClient, SERVER_CONFIG } from './server-config.js';
import { clientStreamInstance } from './config.js';
import type { AuthModel } from 'pocketbase';

/**
 * Stream Chat Authentication Module
 *
 * This module handles user authentication and token management for Stream Chat.
 * It provides functions for creating, refreshing, and revoking user tokens.
 */

/**
 * Interface for Stream user data
 */
export interface StreamUser {
	id: string;
	name: string;
	image?: string;
	role?: string;
	online?: boolean;
	created_at?: string;
	updated_at?: string;
}

/**
 * Interface for token response
 */
export interface TokenResponse {
	token: string;
	expires_at: number;
	user: StreamUser;
}

/**
 * Creates a new Stream Chat token for a user
 *
 * @param user - The authenticated user from PocketBase
 * @returns Promise<TokenResponse> - Token and user information
 * @throws Error if user is not authenticated or token creation fails
 */
export async function createUserToken(user: AuthModel): Promise<TokenResponse> {
	if (!user?.id) {
		throw new Error('User not authenticated');
	}

	try {
		// Calculate token expiration time
		const expiresAt = Math.floor(Date.now() / 1000) + SERVER_CONFIG.TOKEN_EXPIRATION;

		// Create token with expiration
		const token = serverClient.createToken(user.id, expiresAt);

		// Map PocketBase roles to valid Stream Chat roles
		// This ensures proper permissions for commenting
		const getStreamRole = (pbRole: string): string => {
			switch (pbRole) {
				case 'creator':
					return 'moderator'; // Creators get moderator permissions
				case 'client':
				default:
					return 'user'; // Regular users get basic user permissions
			}
		};

		// Prepare user data for Stream
		const streamUser: StreamUser = {
			id: user.id,
			name: user.name || `User ${user.id}`,
			image: user.avatar || undefined,
			role: getStreamRole(user.role || 'client'),
			created_at: user.created || new Date().toISOString(),
			updated_at: user.updated || new Date().toISOString()
		};

		// Update or create user in Stream (server-side operation)
		await serverClient.upsertUser(streamUser);

		return {
			token,
			expires_at: expiresAt,
			user: streamUser
		};
	} catch (error) {
		console.error('Failed to create Stream token:', error);
		throw new Error('Failed to create authentication token');
	}
}

/**
 * Refreshes an existing Stream Chat token for a user
 *
 * @param user - The authenticated user from PocketBase
 * @returns Promise<TokenResponse> - New token and user information
 * @throws Error if user is not authenticated or token refresh fails
 */
export async function refreshUserToken(user: AuthModel): Promise<TokenResponse> {
	if (!user?.id) {
		throw new Error('User not authenticated');
	}

	try {
		// Try to revoke the existing token first, but don't fail if user doesn't exist
		try {
			await serverClient.revokeUserToken(user.id);
		} catch (revokeError: any) {
			// If user doesn't exist in Stream, that's fine - we'll create them
			if (revokeError?.status !== 404) {
				console.warn('Failed to revoke token, but continuing:', revokeError);
			}
		}

		// Create a new token (will create user if they don't exist)
		return await createUserToken(user);
	} catch (error) {
		console.error('Failed to refresh Stream token:', error);
		throw new Error('Failed to refresh authentication token');
	}
}

/**
 * Revokes a user's Stream Chat token
 *
 * @param userId - The user ID to revoke token for
 * @returns Promise<void>
 * @throws Error if token revocation fails
 */
export async function revokeUserToken(userId: string): Promise<void> {
	if (!userId) {
		throw new Error('User ID is required');
	}

	try {
		await serverClient.revokeUserToken(userId);
	} catch (error) {
		console.error('Failed to revoke Stream token:', error);
		throw new Error('Failed to revoke authentication token');
	}
}

/**
 * Connects a user to Stream Chat (client-side operation)
 * This should be called when the user token is available
 *
 * @param user - Stream user data
 * @param token - Valid Stream user token
 * @returns Promise<void>
 * @throws Error if connection fails
 */
export async function connectUser(user: StreamUser, token: string): Promise<void> {
	try {
		await clientStreamInstance.connectUser(user, token);
	} catch (error) {
		console.error('Failed to connect user to Stream:', error);
		throw new Error('Failed to connect to chat service');
	}
}

/**
 * Disconnects the current user from Stream Chat
 *
 * @returns Promise<void>
 */
export async function disconnectUser(): Promise<void> {
	try {
		await clientStreamInstance.disconnectUser();
	} catch (error) {
		console.error('Failed to disconnect user from Stream:', error);
		// Don't throw error for disconnect failures
	}
}

/**
 * Checks if a user is currently connected to Stream Chat
 *
 * @returns boolean - True if user is connected
 */
export function isUserConnected(): boolean {
	return clientStreamInstance.user != null;
}

/**
 * Gets the currently connected user
 *
 * @returns StreamUser | null - Current user or null if not connected
 */
export function getCurrentUser(): StreamUser | null {
	const user = clientStreamInstance.user;
	if (!user) return null;

	return {
		id: user.id,
		name: user.name || '',
		image: user.image,
		role: user.role,
		online: user.online,
		created_at: user.created_at,
		updated_at: user.updated_at
	};
}
