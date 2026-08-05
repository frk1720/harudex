/**
 * HaruDex - Spring Drive Index (Google Drive Backend)
 */

interface Env {
	SITE_PASSWORD?: string;
	GD_CLIENT_ID: string;
	GD_CLIENT_SECRET: string;
	GD_REFRESH_TOKEN: string;
	GD_ROOT_FOLDER: string;
}

// Global cache for access token to avoid fetching it on every request
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

const PAGE_SIZE = 500;

async function getAccessToken(env: Env): Promise<string> {
	if (cachedAccessToken && Date.now() < tokenExpiresAt) {
		return cachedAccessToken;
	}

	const response = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: env.GD_CLIENT_ID,
			client_secret: env.GD_CLIENT_SECRET,
			refresh_token: env.GD_REFRESH_TOKEN,
			grant_type: 'refresh_token',
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(`Failed to refresh token: ${text}`);
	}

	const data: any = await response.json();
	cachedAccessToken = data.access_token;
	tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000; // subtract 5 mins for safety
	return cachedAccessToken!;
}

// Daily auth token in UTC+7, matching what /api/login issues
function todayToken(): string {
	const dateStr = new Date(Date.now() + 7 * 3600 * 1000).toISOString().split('T')[0];
	return `killdrive-token-${dateStr}`;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		// CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(),
			});
		}

		// Handle API routes
		if (url.pathname.startsWith('/api/')) {
			// Simple Login Endpoint
			if (url.pathname === '/api/login' && request.method === 'POST') {
				try {
					const body: any = await request.json();
					const password = body.password;

					const sitePass = env.SITE_PASSWORD || 'harudex';
					if (password === sitePass) {
						// Create token with today's date (UTC+7)
						return Response.json({ success: true, token: todayToken() });
					} else {
						return Response.json({ success: false, message: 'Invalid password' }, { status: 401 });
					}
				} catch (e) {
					return Response.json({ success: false, message: 'Bad request' }, { status: 400 });
				}
			}

			// Endpoint to list files from Google Drive
			if (url.pathname === '/api/list') {
				// Daily Auth Check
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${todayToken()}`) {
					return Response.json({ success: false, message: 'Unauthorized or token expired' }, { status: 401 });
				}

				const folderId = url.searchParams.get('id') || env.GD_ROOT_FOLDER || 'root';

				try {
					const accessToken = await getAccessToken(env);
					const files = await listFolder(accessToken, folderId);
					return Response.json({
						success: true,
						currentId: folderId,
						files,
					});
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// Endpoint to download/proxy file
			if (url.pathname === '/api/file') {
				// File access is PUBLIC (bypasses auth)
				// Anyone with the file ID can access it directly.

				const fileId = url.searchParams.get('id');
				if (!fileId) return new Response('Missing id', { status: 400 });

				try {
					const accessToken = await getAccessToken(env);
					return await streamFile(request, fileId, accessToken);
				} catch (err: any) {
					return new Response(err.message, { status: 500 });
				}
			}

			return Response.json({ error: 'Not Found' }, { status: 404 });
		}

		// Fallback for static assets missed by wrangler
		return new Response('Route Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

// Collects all files inside a folder, following Google Drive pagination
// so folders with more than PAGE_SIZE items are fully returned.
async function listFolder(accessToken: string, folderId: string): Promise<any[]> {
	const q = `'${folderId}' in parents and trashed = false`;
	const fields = 'nextPageToken,files(id, name, mimeType, size, modifiedTime)';
	const allFiles: any[] = [];
	let pageToken: string | undefined;

	do {
		const params = new URLSearchParams({
			q,
			fields,
			orderBy: 'folder,name',
			pageSize: String(PAGE_SIZE),
			spaces: 'drive',
		});
		if (pageToken) params.set('pageToken', pageToken);

		const gdUrl = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
		const gdResponse = await fetch(gdUrl, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		if (!gdResponse.ok) {
			const text = await gdResponse.text();
			throw new Error(`GD Error ${gdResponse.status}: ${text}`);
		}

		const data: any = await gdResponse.json();
		allFiles.push(...(data.files || []));
		pageToken = data.nextPageToken;
	} while (pageToken);

	return allFiles.map((f: any) => ({
		id: f.id,
		name: f.name,
		mimeType: f.mimeType,
		size: f.size || '0',
		modifiedTime: f.modifiedTime,
		isFolder: f.mimeType === 'application/vnd.google-apps.folder',
	}));
}

// Streams a Google Drive file through the worker, preserving Range
// requests so video players can seek and stream efficiently.
async function streamFile(request: Request, fileId: string, accessToken: string): Promise<Response> {
	// Get file metadata first
	const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`;
	const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

	if (!metaRes.ok) {
		throw new Error(`GD Error ${metaRes.status}: ${metaRes.statusText}`);
	}

	const meta: any = await metaRes.json();

	// HEAD requests (used by video players to probe metadata) return no body.
	if (request.method === 'HEAD') {
		const headers = new Headers();
		headers.set('Content-Type', meta.mimeType || 'application/octet-stream');
		headers.set('Accept-Ranges', 'bytes');
		if (meta.size) headers.set('Content-Length', String(meta.size));
		headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`);
		applyCors(headers);
		return new Response(null, { status: 200, headers });
	}

	// Fetch the actual file content
	const fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
	const proxyRequest = new Request(fetchUrl, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Range: request.headers.get('Range') || '',
		},
	});

	if (!proxyRequest.headers.get('Range')) proxyRequest.headers.delete('Range');

	let fileResponse = await fetch(proxyRequest);

	// Reconstruct response to pass headers (Content-Type, Content-Disposition, etc)
	const headers = new Headers(fileResponse.headers);
	headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`);
	if (meta.mimeType) headers.set('Content-Type', meta.mimeType);
	// Allow byte-range requests so media players can seek
	headers.set('Accept-Ranges', 'bytes');
	// Enable CORS
	applyCors(headers);

	return new Response(fileResponse.body, {
		status: fileResponse.status,
		headers: headers,
	});
}

function corsHeaders(): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
		'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition',
	};
}

function applyCors(headers: Headers): void {
	const cors = corsHeaders();
	for (const [key, value] of Object.entries(cors)) {
		headers.set(key, value);
	}
}