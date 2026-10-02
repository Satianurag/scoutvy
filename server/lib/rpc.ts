import { setTimeout } from "node:timers/promises";

import { createDefaultRpcTransport, createSolanaRpcFromTransport, isSolanaError, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, type RpcTransport } from "@solana/kit";

import { SOLANA_DEVNET_RPC_URL } from "./config.js";

export function retryingTransport(transport: RpcTransport): RpcTransport {
  return async (config) => {
    for (let attempt = 0; ; attempt++) {
      config.signal?.throwIfAborted();
      try {
        return await transport(config);
      } catch (error) {
        if (attempt >= 3 || !isSolanaError(error, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)
          || error.context.statusCode !== 429) throw error;
        const header = error.context.headers.get("retry-after");
        const seconds = header === null ? NaN : Number(header);
        const retryAfter = Number.isFinite(seconds) ? seconds * 1000 : header ? Date.parse(header) - Date.now() : 0;
        const delay = Math.max(2000 * 2 ** attempt, Number.isFinite(retryAfter) ? retryAfter : 0);
        if (delay > 10_000) throw error;
        await setTimeout(delay, undefined, { signal: config.signal });
      }
    }
  };
}

export function createDevnetRpc() {
  return createSolanaRpcFromTransport(retryingTransport(createDefaultRpcTransport({ url: SOLANA_DEVNET_RPC_URL })));
}
