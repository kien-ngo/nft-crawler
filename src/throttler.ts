import { sleep } from "bun";

export async function handleRequestLimit<T>(
	promises: Promise<T>[],
	requestPerSec: number,
) {
	const requestChunks: Promise<T>[][] = [];

	for (let i = 0; i < promises.length; i += requestPerSec) {
		const chunk = promises.slice(i, i + requestPerSec);
		requestChunks.push(chunk);
	}

	console.info(
		`Split ${promises.length} requests into ${requestChunks.length} chunks`,
	);

	let data: T[] = [];

	for (const [index, value] of requestChunks.entries()) {
		console.info(`Indexing chunk number ${index}`);
		data = data.concat(await Promise.all(value));
		await sleep(300);
	}

	return data;
}
