import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';

import PocketBase, { type AuthModel } from 'pocketbase';

import { serializeNonPOJOs } from '$lib';
import { refreshUserToken } from '$lib/stream/server-index.js';

/**
 * SvelteKit Server Hooks
 *
 * This file handles server-side logic for every request, including:
 * - PocketBase authentication setup
 * - Stream Chat token management
 * - User session handling
 */

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.pb = new PocketBase(env.POCKETBASE_URL);

	// Load authentication data from cookies
	event.locals.pb.authStore.loadFromCookie(event.request.headers.get('cookie') || '');

	try {
		// If user is authenticated, refresh their session and Stream token
		if (event.locals.pb.authStore.isValid) {
			// Refresh PocketBase authentication
			await event.locals.pb.collection('users').authRefresh();

			// Get the authenticated user
			const user = event.locals.pb.authStore.record;

			// Refresh Stream Chat token for authenticated users
			if (user?.id) {
				try {
					const tokenResponse = await refreshUserToken(user);
					event.locals['chat-token'] = tokenResponse.token;
				} catch (streamError) {
					// Log Stream token refresh error but don't fail the request
					console.warn('Failed to refresh Stream token:', streamError);
					event.locals['chat-token'] = undefined;
				}
			}
		}

		// Set the user object for use in the application
		event.locals.user = serializeNonPOJOs(event.locals.pb.authStore.record) as
			| AuthModel
			| undefined;
	} catch (error) {
		// Clear authentication on failed refresh
		console.warn('Authentication refresh failed:', error);
		event.locals.pb.authStore.clear();
		event.locals.user = undefined;
		event.locals['chat-token'] = undefined;
	}

	// Add role-based access control for creator routes
	if (event.url.pathname.startsWith('/app/creator')) {
		const user = event.locals.user;
		if (!user || user.role !== 'creator') {
			// Redirect non-creator users to an appropriate page
			return new Response('Access Denied', {
				status: 403,
				headers: {
					'Content-Type': 'text/html'
				}
			});
		}
	}

	// Process the request
	const response = await resolve(event);

	// Send back the authentication cookie with latest state
	response.headers.append(
		'set-cookie',
		event.locals.pb.authStore.exportToCookie({
			secure: env.NODE_ENV === 'production',
			httpOnly: true,
			sameSite: 'strict'
		})
	);

	return response;
};

// const handleParaglide: Handle = ({ event, resolve }) =>
// 	paraglideMiddleware(event.request, ({ request, locale }) => {
// 		event.request = request;

// 		return resolve(event, {
// 			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
// 		});
// 	});

// export const handle: Handle = handleParaglide;
