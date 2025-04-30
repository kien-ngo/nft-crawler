import { defineChain, getContract, isAddress, type Chain } from "thirdweb";
import { getBytecode } from "thirdweb/contract";
import { client } from "./src/client";
import { crawlNfts } from "./src/crawl-nfts";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Chain id should be a positive integer number
const isValidChainId = (value: string) =>
	/^\d+$/.test(value) && Number.parseInt(value, 10) > 0;

// Should be a valid EVM address and should check if it resolves in a valid bytecode
const isValidAddress = async (address: string, chain: Chain) => {
	if (!isAddress(address)) return false;
	const contract = getContract({
		address,
		chain,
		client,
	});
	const bytecode = await getBytecode(contract);
	if (!bytecode || bytecode === "0x") return false;
	return true;
};

const PORT = 3000;

console.info(`Server is running at port: ${PORT}`);

// The actual server
Bun.serve({
	port: PORT,
	// Only accepts this type of route: http://localhost:3000/1/0x0000000000000000000000000000000000000000
	async fetch(req) {
		const url = new URL(req.url);
		const parts = url.pathname.split("/").filter(Boolean); // remove leading/trailing slashes

		if (parts.length !== 2) {
			return new Response("Invalid route. Use /<chainId>/<contractAddress>", {
				status: 400,
			});
		}

		const [possibleChainId, possibleContractAddress] = parts;

		if (!possibleChainId) {
			return new Response("Invalid chainId. It must be a positive integer.", {
				status: 400,
			});
		}

		if (!isValidChainId(possibleChainId)) {
			return new Response("Invalid chainId. It must be a positive integer.", {
				status: 400,
			});
		}

		if (!possibleContractAddress) {
			return new Response("Invalid contract address.", { status: 400 });
		}

		const chainId = Number(possibleChainId);
		const chain = defineChain(chainId);

		if (!(await isValidAddress(possibleContractAddress, chain))) {
			return new Response("Invalid contract address.", { status: 400 });
		}

		const contractAddress = String(possibleContractAddress);

		const contract = getContract({
			address: contractAddress,
			chain,
			client,
		});

		const path = `./indexed-data/${chainId}/${contractAddress}.json`;

		console.info(`Indexing nft. The data will be saved to ${path}`);

		const data = await crawlNfts(contract);
		console.info("All data indexed");

		mkdirSync(dirname(path), { recursive: true });

		console.info("Writing data to json file");
		await Bun.write(path, JSON.stringify(data, null, 2));
		console.info("Data written to file.");

		return new Response(
			JSON.stringify({
				chainId: Number(chainId),
				contractAddress,
				message: `Indexed. Data was saved to ${path}`,
			}),
			{ status: 200, headers: { "Content-Type": "application/json" } },
		);
	},
	idleTimeout: 255,
});
