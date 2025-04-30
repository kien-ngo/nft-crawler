import type { NFT, ThirdwebContract } from "thirdweb";
import {
	getNFT as getNFT1155,
	isERC1155,
	nextTokenIdToMint as nextTokenIdToMint1155,
} from "thirdweb/extensions/erc1155";
import {
	getNFT as getNFT721,
	isERC721,
	nextTokenIdToMint as nextTokenIdToMint721,
	startTokenId,
	totalSupply,
} from "thirdweb/extensions/erc721";
import { handleRequestLimit } from "./throttler";
import { maxUint256 } from "thirdweb/utils";

// If you have a higher tier thirdweb API you can raise this number.
const REQUEST_PER_SEC = 50;

/**
 * Start pulling the metadata of every NFT in a collection.
 * A throttle logic is used to avoid exceeding rate limit on thirdweb service (we are using thirdweb)
 */
export async function crawlNfts(contract: ThirdwebContract) {
	if (await isERC721({ contract })) return crawlERC721(contract);
	if (await isERC1155({ contract })) return crawlERC1155(contract);
	throw new Error("Error: This collection is neither ERC721 nor ERC1155");
}

async function crawlERC721(contract: ThirdwebContract) {
	// Get the startTokenId and highest tokenId of the collection
	// then loop over it until all owners are fetched
	const [startTokenId_, maxSupply] = await Promise.allSettled([
		startTokenId({ contract }),
		nextTokenIdToMint721({ contract }),
		totalSupply({ contract }),
	]).then(([_startTokenId, _next, _total]) => {
		// default to 0 if startTokenId is not available
		const startTokenId__ =
			_startTokenId.status === "fulfilled" ? _startTokenId.value : 0n;
		let maxSupply_: bigint;
		// prioritize nextTokenIdToMint
		if (_next.status === "fulfilled") {
			// because we always default the startTokenId to 0 we can safely just always subtract here
			maxSupply_ = _next.value - startTokenId__;
		}
		// otherwise use totalSupply
		else if (_total.status === "fulfilled") {
			maxSupply_ = _total.value;
		} else {
			throw new Error(
				"Contract requires either `nextTokenIdToMint` or `totalSupply` function available to determine the next token ID to mint",
			);
		}
		return [startTokenId__, maxSupply_] as const;
	});
	const maxId = maxSupply + startTokenId_;

	const promises: Promise<NFT>[] = [];

	for (let i = startTokenId_; i < maxId; i++) {
		promises.push(getNFT721({ tokenId: i, contract }));
	}

	console.info(`Found ${promises.length} tokens. Starting to index...`);
	const data = await handleRequestLimit<NFT>(promises, REQUEST_PER_SEC);
	return data;
}

async function crawlERC1155(contract: ThirdwebContract) {
	// try to get the totalCount (non-standard) - if this fails then just use maxUint256
	const totalCount = await nextTokenIdToMint1155({ contract }).catch(
		() => maxUint256,
	);

	const promises: Promise<NFT>[] = [];

	for (let i = 0n; i < totalCount; i++) {
		promises.push(
			getNFT1155({
				contract,
				tokenId: i,
			}),
		);
	}
	console.info(`Found ${promises.length} tokens. Starting to index...`);
	const data = await handleRequestLimit<NFT>(promises, REQUEST_PER_SEC);
	return data;
}
