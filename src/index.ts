/**
 * HaruDex - Spring Drive Index (Google Drive Backend)
 */

interface Env {
	SITE_PASSWORD?: string;
	GD_CLIENT_ID: string;
	GD_CLIENT_SECRET: string;
	GD_REFRESH_TOKEN: string;
	GD_ROOT_FOLDER: string;
	DB: D1Database;
	ASSETS: Fetcher;
}

// Global cache for access token to avoid fetching it on every request
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

const PAGE_SIZE = 500;
const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

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

// Normalizes common typos when typing/pasting a password:
// - trims accidental leading/trailing whitespace
// - treats curly apostrophes (U+2018/U+2019) as a straight apostrophe (U+0027)
function normalizePassword(value: string): string {
	return (value || '').trim().replace(/[\u2018\u2019]/g, "'");
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

		// Legacy alias: /s/<code> -> /folder/<code> (SPA serves the app for /folder/*)
		if (url.pathname.startsWith('/s/')) {
			const code = url.pathname.slice(3);
			if (!code) return new Response('Missing code', { status: 400 });
			return Response.redirect(new URL(`/folder/${code}`, request.url).toString(), 308);
		}

		// Direct download link: /file/<code>/<name> — hides the Google Drive file ID.
		// The short code maps to the file in D1 and the worker streams the file, so the
		// ID never appears in the URL.
		if (url.pathname.startsWith('/file/')) {
			const parts = url.pathname.split('/').filter(Boolean);
			const code = parts[1];
			if (!code) return new Response('Missing code', { status: 400 });
			try {
				const row = await env.DB.prepare('SELECT file_id FROM file_links WHERE code = ?').bind(code).first<{ file_id: string }>();
				if (!row) return new Response('Link not found', { status: 404 });
				const accessToken = await getAccessToken(env);
				return await streamFile(request, row.file_id, accessToken, true);
			} catch (err: any) {
				return new Response(err.message, { status: 500 });
			}
		}

		// Handle API routes
		if (url.pathname.startsWith('/api/')) {
			// Simple Login Endpoint
			if (url.pathname === '/api/login' && request.method === 'POST') {
				try {
					const body: any = await request.json();
					const password = normalizePassword(body.password);

					const sitePass = normalizePassword(env.SITE_PASSWORD || 'harudex');
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

			// Endpoint to list files from Google Drive.
			// Access rules:
			//   - If a public shortlink code is provided, the folder is served WITHOUT login
			//     if it is (or is nested inside) the shared folder.
			//   - Otherwise a valid daily token is required.
			if (url.pathname === '/api/list') {
				const publicCode = url.searchParams.get('code');
				const folderId = url.searchParams.get('id') || env.GD_ROOT_FOLDER || 'root';

				// Determine if this request is allowed
				let authorized = false;
				if (publicCode) {
					try {
						const shared = await env.DB.prepare('SELECT folder_id FROM shortlinks WHERE code = ?').bind(publicCode).first<{ folder_id: string }>();
						if (shared) {
							const accessToken = await getAccessToken(env);
							authorized = folderId === shared.folder_id || (await isDescendant(accessToken, folderId, shared.folder_id));
						}
					} catch (e) {
						// fall through to token check if anything goes wrong
					}
				}
				if (!authorized) {
					const authHeader = request.headers.get('Authorization');
					authorized = authHeader === `Bearer ${todayToken()}`;
				}
				if (!authorized) {
					return Response.json({ success: false, message: 'Unauthorized or token expired' }, { status: 401 });
				}

				try {
					const accessToken = await getAccessToken(env);
					const files = await listFolder(accessToken, folderId);

					// Ensure every folder (incl. subfolders shown here) has its own short URL
					const codeByFolder = await ensureShortlinks(env.DB, files.filter((f) => f.isFolder));
					const origin = new URL(request.url).origin;
					const filesWithLinks = files.map((f) => {
						if (f.isFolder && codeByFolder[f.id]) {
							return { ...f, shortUrl: `${origin}/folder/${codeByFolder[f.id]}` };
						}
						return f;
					});

					// Also ensure the current folder itself has a short URL
					const currentCode = await ensureShortlink(env.DB, folderId, '');
					return Response.json({
						success: true,
						currentId: folderId,
						currentShortUrl: `${origin}/folder/${currentCode}`,
						files: filesWithLinks,
					});
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// Endpoint to search files globally in Google Drive
			if (url.pathname === '/api/search' && request.method === 'GET') {
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${todayToken()}`) {
					return Response.json({ success: false, message: 'Unauthorized or token expired' }, { status: 401 });
				}

				const query = url.searchParams.get('q');
				if (!query) return Response.json({ success: false, message: 'Missing query string' }, { status: 400 });

				try {
					const accessToken = await getAccessToken(env);
					const safeQuery = query.replace(/'/g, "\\'");
					const gdQuery = `name contains '${safeQuery}' and trashed = false`;
					const fields = 'nextPageToken,files(id, name, mimeType, size, modifiedTime)';
					
					const params = new URLSearchParams({
						q: gdQuery,
						fields,
						orderBy: 'folder,name',
						pageSize: '200', // Limit search results to 200 to keep it fast
						spaces: 'drive',
					});

					const gdUrl = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
					const gdResponse = await fetch(gdUrl, {
						headers: { Authorization: `Bearer ${accessToken}` },
					});

					if (!gdResponse.ok) {
						const text = await gdResponse.text();
						throw new Error(`GD Error ${gdResponse.status}: ${text}`);
					}

					const data: any = await gdResponse.json();
					const rawFiles = data.files || [];

					const files = rawFiles.map((f: any) => ({
						id: f.id,
						name: f.name,
						mimeType: f.mimeType,
						size: f.size || '0',
						modifiedTime: f.modifiedTime,
						isFolder: f.mimeType === 'application/vnd.google-apps.folder',
					}));

					const codeByFolder = await ensureShortlinks(env.DB, files.filter((f: any) => f.isFolder));
					const origin = new URL(request.url).origin;
					const filesWithLinks = files.map((f: any) => {
						if (f.isFolder && codeByFolder[f.id]) {
							return { ...f, shortUrl: `${origin}/folder/${codeByFolder[f.id]}` };
						}
						return f;
					});

					return Response.json({
						success: true,
						files: filesWithLinks,
					});
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// Endpoint to create shortlink: /api/shortlink?folder=<id>&name=<name>
			if (url.pathname === '/api/shortlink' && request.method === 'GET') {
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${todayToken()}`) {
					return Response.json({ success: false, message: 'Unauthorized or token expired' }, { status: 401 });
				}

				const folderId = url.searchParams.get('folder');
				const name = url.searchParams.get('name') || '';
				if (!folderId) return Response.json({ success: false, message: 'Missing folder id' }, { status: 400 });

				try {
					const code = await ensureShortlink(env.DB, folderId, name);
					return Response.json({
						success: true,
						code,
						url: `${new URL(request.url).origin}/folder/${code}`,
					});
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// Endpoint to create a short download link for a file:
			//   /api/filelink?id=<fileId>&name=<name> -> /file/<code>/<name>
			if (url.pathname === '/api/filelink' && request.method === 'GET') {
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${todayToken()}`) {
					return Response.json({ success: false, message: 'Unauthorized or token expired' }, { status: 401 });
				}

				const fileId = url.searchParams.get('id');
				const name = url.searchParams.get('name') || 'file';
				if (!fileId) return Response.json({ success: false, message: 'Missing file id' }, { status: 400 });

				try {
					const code = await ensureFileLink(env.DB, fileId, name);
					return Response.json({
						success: true,
						code,
						url: `${new URL(request.url).origin}/file/${code}/${encodeURIComponent(name)}`,
					});
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// Resolve a short code to its folder (public — used by the SPA on /folder/<code>)
			if (url.pathname === '/api/resolve' && request.method === 'GET') {
				const code = url.searchParams.get('code');
				if (!code) return Response.json({ success: false, message: 'Missing code' }, { status: 400 });

				try {
					const row = await env.DB.prepare('SELECT folder_id, name FROM shortlinks WHERE code = ?').bind(code).first<{ folder_id: string; name: string }>();
					if (!row) return Response.json({ success: false, message: 'Shortlink not found' }, { status: 404 });
					return Response.json({ success: true, folderId: row.folder_id, name: row.name });
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// List all shortlinks
			if (url.pathname === '/api/shortlinks' && request.method === 'GET') {
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${todayToken()}`) {
					return Response.json({ success: false, message: 'Unauthorized or token expired' }, { status: 401 });
				}

				try {
					const { results } = await env.DB.prepare(
						'SELECT code, folder_id, name, created_at FROM shortlinks ORDER BY created_at DESC'
					).all();
					return Response.json({ success: true, shortlinks: results });
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// Delete a shortlink
			if (url.pathname === '/api/shortlink' && request.method === 'DELETE') {
				const authHeader = request.headers.get('Authorization');
				if (authHeader !== `Bearer ${todayToken()}`) {
					return Response.json({ success: false, message: 'Unauthorized or token expired' }, { status: 401 });
				}

				const code = url.searchParams.get('code');
				if (!code) return Response.json({ success: false, message: 'Missing code' }, { status: 400 });

				try {
					await env.DB.prepare('DELETE FROM shortlinks WHERE code = ?').bind(code).run();
					return Response.json({ success: true });
				} catch (err: any) {
					return Response.json({ success: false, message: err.message }, { status: 500 });
				}
			}

			// Endpoint to download/proxy file.
			//   /api/file?id=X            -> stream inline (media player can seek)
			//   /api/file?id=X&download=1 -> force download (attachment)
			if (url.pathname === '/api/file' || url.pathname.startsWith('/api/file/')) {
				// File access is PUBLIC (bypasses auth)
				// Anyone with the file ID can access it directly.

				const fileId = url.searchParams.get('id');
				if (!fileId) return new Response('Missing id', { status: 400 });

				const asDownload = url.searchParams.get('download') === '1';
				try {
					const accessToken = await getAccessToken(env);
					return await streamFile(request, fileId, accessToken, asDownload);
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

// Walks up the Google Drive parent chain from `folderId` to check whether
// it is `ancestorId` itself or nested somewhere inside it. Used to allow
// public access to a shared folder and everything beneath it.
async function isDescendant(accessToken: string, folderId: string, ancestorId: string): Promise<boolean> {
	let current = folderId;
	for (let i = 0; i < 30; i++) {
		if (current === ancestorId) return true;
		const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(current)}?fields=parents`, {
			headers: { Authorization: `Bearer ${accessToken}` },
		});
		if (!res.ok) return false;
		const data: any = await res.json();
		const parent = Array.isArray(data.parents) ? data.parents[0] : undefined;
		if (!parent) return false;
		current = parent;
	}
	return false;
}

// ---------- Shortlink helpers ----------

function generateCode(): string {
	const bytes = new Uint8Array(6);
	crypto.getRandomValues(bytes);
	let code = '';
	for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
	return code;
}

// Returns the short code for a folder, creating one if it doesn't exist yet.
async function ensureShortlink(db: D1Database, folderId: string, name: string): Promise<string> {
	const existing = await db.prepare('SELECT code FROM shortlinks WHERE folder_id = ?').bind(folderId).first<{ code: string }>();
	if (existing) return existing.code;

	// Try a few times in case of a code collision
	for (let i = 0; i < 5; i++) {
		const code = generateCode();
		const res = await db
			.prepare('INSERT OR IGNORE INTO shortlinks (code, folder_id, name) VALUES (?, ?, ?)')
			.bind(code, folderId, name || '')
			.run();
		if (res.meta.changes > 0) return code;
	}

	// Fall back to whatever is stored now
	const again = await db.prepare('SELECT code FROM shortlinks WHERE folder_id = ?').bind(folderId).first<{ code: string }>();
	if (again) return again.code;
	throw new Error('Failed to create shortlink');
}

// Batch version for a list of folders. Returns { [folderId]: code }.
async function ensureShortlinks(db: D1Database, folders: { id: string; name: string }[]): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	if (!folders.length) return result;

	// Find which folders already have a short link
	const placeholders = folders.map(() => '?').join(',');
	const rows = await db
		.prepare(`SELECT folder_id, code FROM shortlinks WHERE folder_id IN (${placeholders})`)
		.bind(...folders.map((f) => f.id))
		.all<{ folder_id: string; code: string }>();
	for (const row of rows.results || []) {
		result[row.folder_id] = row.code;
	}

	// Insert short links for the folders that don't have one yet
	const missing = folders.filter((f) => !result[f.id]);
	const pending = missing.map((f) => ({ folder: f, code: generateCode() }));
	const statements = pending.map((p) =>
		db.prepare('INSERT OR IGNORE INTO shortlinks (code, folder_id, name) VALUES (?, ?, ?)').bind(p.code, p.folder.id, p.folder.name || '')
	);
	if (statements.length) {
		const batch = await db.batch(statements);
		batch.forEach((res, i) => {
			if (res.meta.changes > 0) result[pending[i].folder.id] = pending[i].code;
		});
	}

	// Any folders whose insert was ignored (e.g. code collision) — fetch what was actually stored
	const stillMissing = folders.filter((f) => !result[f.id]);
	if (stillMissing.length) {
		const ph = stillMissing.map(() => '?').join(',');
		const rows2 = await db
			.prepare(`SELECT folder_id, code FROM shortlinks WHERE folder_id IN (${ph})`)
			.bind(...stillMissing.map((f) => f.id))
			.all<{ folder_id: string; code: string }>();
		for (const row of rows2.results || []) {
			result[row.folder_id] = row.code;
		}
	}

	return result;
}

// Returns the short code for a file download link, creating one if it doesn't exist yet.
// The file ID is never exposed in the shared URL.
async function ensureFileLink(db: D1Database, fileId: string, name: string): Promise<string> {
	const existing = await db.prepare('SELECT code FROM file_links WHERE file_id = ?').bind(fileId).first<{ code: string }>();
	if (existing) return existing.code;

	// Try a few times in case of a code collision
	for (let i = 0; i < 5; i++) {
		const code = generateCode();
		const res = await db
			.prepare('INSERT OR IGNORE INTO file_links (code, file_id, name) VALUES (?, ?, ?)')
			.bind(code, fileId, name || '')
			.run();
		if (res.meta.changes > 0) return code;
	}

	// Fall back to whatever is stored now
	const again = await db.prepare('SELECT code FROM file_links WHERE file_id = ?').bind(fileId).first<{ code: string }>();
	if (again) return again.code;
	throw new Error('Failed to create file link');
}

// Streams a Google Drive file through the worker, preserving Range
// requests so video players can seek and stream efficiently.
// When asDownload is true, the response forces the browser to save
// the file instead of playing it inline.
async function streamFile(request: Request, fileId: string, accessToken: string, asDownload = false): Promise<Response> {
	// Get file metadata first
	const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`;
	const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

	if (!metaRes.ok) {
		throw new Error(`GD Error ${metaRes.status}: ${metaRes.statusText}`);
	}

	const meta: any = await metaRes.json();
	const disposition = asDownload ? 'attachment' : 'inline';
	const displayName = meta.name || 'file';
	// Plain filename for players that ignore RFC 5987 (filename*), plus the RFC 5987 form for non-ASCII names.
	const fallbackName = displayName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'file';
	const contentDisposition = `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(displayName)}`;

	// HEAD requests (used by video players to probe metadata) return no body.
	if (request.method === 'HEAD') {
		const headers = new Headers();
		headers.set('Content-Type', meta.mimeType || 'application/octet-stream');
		headers.set('Accept-Ranges', 'bytes');
		if (meta.size) headers.set('Content-Length', String(meta.size));
		headers.set('Content-Disposition', contentDisposition);
		applyCors(headers);
		return new Response(null, { status: 200, headers });
	}

	// Fetch the actual file content
	const fetchUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
	const proxyRequest = new Request(fetchUrl, {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Range: asDownload ? '' : (request.headers.get('Range') || ''),
		},
	});

	// Range is only useful for streaming; downloads get the whole file
	if (!proxyRequest.headers.get('Range')) proxyRequest.headers.delete('Range');

	let fileResponse = await fetch(proxyRequest);

	// Reconstruct response to pass headers (Content-Type, Content-Disposition, etc)
	const headers = new Headers(fileResponse.headers);
	headers.set('Content-Disposition', contentDisposition);
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
		'Access-Control-Allow-Methods': 'GET, POST, HEAD, DELETE, OPTIONS',
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
