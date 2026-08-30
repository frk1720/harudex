import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';

const driveId = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

function createDb() {
	return {
		prepare(query: string) {
			return {
				bind(..._params: unknown[]) {
					return {
						first: async () => null,
						run: async () => ({ meta: { changes: 1 } }),
					};
				},
			};
		},
	} as unknown as D1Database;
}

function createEnv() {
	return {
		DB: createDb(),
		ASSETS: {} as Fetcher,
		GD_CLIENT_ID: 'client-id',
		GD_CLIENT_SECRET: 'client-secret',
		GD_REFRESH_TOKEN: 'refresh-token',
		GD_ROOT_FOLDER: 'root',
	} as Env;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('/findpath', () => {
	it('redirects a Drive file to a tokenized URL without exposing the Drive ID', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const requestUrl = String(input);
				if (requestUrl === 'https://oauth2.googleapis.com/token') {
					return Response.json({ access_token: 'access-token', expires_in: 3600 });
				}
				if (requestUrl.includes(`/drive/v3/files/${driveId}?`)) {
					return Response.json({ id: driveId, name: 'Benchmark.ovl', mimeType: 'application/octet-stream' });
				}
				throw new Error(`Unexpected request: ${requestUrl}`);
			}),
		);

		const response = await worker.fetch(new Request(`https://index.example/findpath?id=${driveId}`), createEnv(), {} as ExecutionContext);

		expect(response.status).toBe(302);
		const location = response.headers.get('Location');
		expect(location).toMatch(/^https:\/\/index\.example\/file\/[A-Za-z0-9]{6}\/Benchmark\.ovl$/);
		expect(location).not.toContain(driveId);
	});

	it('redirects a Drive folder to a tokenized folder URL', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const requestUrl = String(input);
				if (requestUrl.includes(`/drive/v3/files/${driveId}?`)) {
					return Response.json({ id: driveId, name: 'Movies', mimeType: 'application/vnd.google-apps.folder' });
				}
				throw new Error(`Unexpected request: ${requestUrl}`);
			}),
		);

		const response = await worker.fetch(new Request(`https://index.example/fp/${driveId}`), createEnv(), {} as ExecutionContext);

		expect(response.status).toBe(302);
		const location = response.headers.get('Location');
		expect(location).toMatch(/^https:\/\/index\.example\/folder\/[A-Za-z0-9]{6}$/);
		expect(location).not.toContain(driveId);
	});

	it('rejects an invalid Drive ID before calling Google Drive', async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal('fetch', fetchMock);

		const response = await worker.fetch(
			new Request('https://index.example/findpath?id=not%20a%20drive%20id'),
			createEnv(),
			{} as ExecutionContext,
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe('Invalid id');
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
