import { HTTPFacilitatorClient } from "@x402/core/http";
import { x402ResourceServer } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { createFacilitatorConfig } from "@coinbase/x402";

const CDP_FACILITATOR_URL = "https://api.cdp.coinbase.com/platform/v2/x402";

function buildFacilitatorConfig() {
  // CDP keys → production facilitator (preferred)
  if (process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET) {
    return createFacilitatorConfig(
      process.env.CDP_API_KEY_ID,
      process.env.CDP_API_KEY_SECRET
    );
  }
  // Explicit FACILITATOR_URL override
  if (process.env.FACILITATOR_URL) {
    return { url: process.env.FACILITATOR_URL };
  }
  // Default CDP endpoint (no auth – public testnet)
  return { url: CDP_FACILITATOR_URL };
}

const facilitatorClient = new HTTPFacilitatorClient(buildFacilitatorConfig());

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server);

export { server as x402Server };
