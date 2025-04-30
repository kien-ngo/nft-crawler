import { createThirdwebClient } from "thirdweb";

if (!Bun.env.THIRDWEB_SECRET_KEY) {
	throw new Error("No `THIRDWEB_SECRET_KEY` set!");
}

export const client = createThirdwebClient({
	secretKey: Bun.env.THIRDWEB_SECRET_KEY,
	config: {
		storage: {
			gatewayUrl: Bun.env.IPFS_GATEWAY,
		},
	},
});
