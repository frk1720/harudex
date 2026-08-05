/**
 * HaruDex - Spring Drive Index (Google Drive Backend)
 * 
 * This worker acts as an API proxy for Google Drive.
 * Add your Google Drive API credentials via Cloudflare Secrets or wrangler.jsonc:
 * - GD_CLIENT_ID
 * - GD_CLIENT_SECRET
 * - GD_REFRESH_TOKEN
 * - SITE_PASSWORD (untuk mengunci akses)
 */

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// Handle API routes
		if (url.pathname.startsWith('/api/')) {
			
			// Simple Login Endpoint
			if (url.pathname === '/api/login' && request.method === 'POST') {
				try {
					const body: any = await request.json();
					const password = body.password;
					
					// TODO: Compare with env.SITE_PASSWORD
					// Mock authentication for now:
					if (password === 'harudex') {
						return Response.json({ success: true, token: 'mock-token-123' });
					} else {
						return Response.json({ success: false, message: 'Invalid password' }, { status: 401 });
					}
				} catch (e) {
					return Response.json({ success: false, message: 'Bad request' }, { status: 400 });
				}
			}

			// Endpoint to list files from Google Drive
			if (url.pathname === '/api/list') {
				// TODO: Fetch from Google Drive API
				return Response.json({
					success: true,
					path: "/",
					files: [
						{ name: "Haru_Vacation_Video.mp4", size: "1.2 GB", type: "video" },
						{ name: "CherryBlossoms.jpg", size: "3.4 MB", type: "image" }
					]
				});
			}

			return Response.json({ error: 'Not Found' }, { status: 404 });
		}

		// Let static assets handle other routes (e.g. / resolving to public/index.html)
		// Usually if not intercepted by assets, we return 404
		return new Response('Route Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
