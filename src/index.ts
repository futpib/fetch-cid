import fsPromises from 'node:fs/promises';
import path from 'node:path';
import pMemoize from 'p-memoize';
import envPaths from 'env-paths';

const paths = envPaths('fetch-cid.futpib.github.io');

function readableWebStreamOnFinish<T>(readableWebStream: ReadableStream<T>, onFinish: () => void): ReadableStream<T> {
	const reader = readableWebStream.getReader();

	const stream = new ReadableStream<T>({
		async start(controller) {
			try {
				for (;;) {
					// eslint-disable-next-line no-await-in-loop
					const { done, value } = await reader.read();
					if (done) {
						break;
					}

					controller.enqueue(value);
				}
			} finally {
				controller.close();
				reader.releaseLock();
				onFinish();
			}
		},
		async cancel(reason) {
			await reader.cancel(reason);
			onFinish();
		},
	});

	return stream;
}

class FsCache {
	async get(key: string): Promise<[ ReadableStream<Uint8Array>, ReadableStream<Uint8Array> ] | undefined> {
		try {
			const file = await fsPromises.open(this._getKeyPath(key), 'r');

			const stream = file.readableWebStream() as ReadableStream<Uint8Array>;

			const streamWithClose = readableWebStreamOnFinish(stream, () => {
				void file.close();
			});

			return [ streamWithClose, undefined as unknown as ReadableStream<Uint8Array> ];
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return undefined;
			}

			throw error;
		}
	}

	async has(key: string) {
		const streams = await this.get(key);
		try {
			return streams !== undefined;
		} finally {
			await Promise.all((streams ?? []).map(async stream => stream?.cancel()));
		}
	}

	async set(key: string, [ _, value ]: [ ReadableStream<Uint8Array>, ReadableStream<Uint8Array> ]) {
		await fsPromises.mkdir(this._basePath, {
			recursive: true,
		});
		const file = await fsPromises.open(this._getKeyPath(key), 'w');
		try {
			for await (const chunk of value) {
				await file.write(chunk);
			}
		} finally {
			await file.close();
		}
	}

	async delete(key: string) {
		await fsPromises.unlink(this._getKeyPath(key));
	}

	private get _basePath() {
		return paths.cache;
	}

	private _getKeyPath(key: string) {
		return path.join(this._basePath, key.replaceAll('/', '_'));
	}
}

export type FetchCidOptions = {
	ipfsBaseUrl?: string;
};

const defaultOptions: Required<FetchCidOptions> = {
	ipfsBaseUrl: 'https://ipfs.io/ipfs/',
};

async function reallyFetchCid(cid: string, options: Required<FetchCidOptions>): Promise<[ ReadableStream<Uint8Array>, ReadableStream<Uint8Array> ]> {
	const response = await fetch(options.ipfsBaseUrl + cid);
	return response.body!.tee();
}

const cachedReallyFetchCid = pMemoize(reallyFetchCid, {
	cache: new FsCache(),
	cacheKey: ([ cid ]) => cid,
});

export async function fetchCid(cid: string, options?: FetchCidOptions): Promise<AsyncIterable<Uint8Array>> {
	const resolvedOptions = { ...defaultOptions, ...options };

	const [ readable, unused ] = await cachedReallyFetchCid(cid, resolvedOptions);
	await unused?.cancel();
	return readable;
}
