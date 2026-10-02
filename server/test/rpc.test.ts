import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SolanaError, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, type RpcTransport } from "@solana/kit";

import { retryingTransport } from "../lib/rpc.js";

const limited = (statusCode = 429, retryAfter?: string) => new SolanaError(SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR, {
  statusCode, message: "HTTP failure", headers: new Headers(retryAfter ? { "Retry-After": retryAfter } : {}),
});
const config = { payload: { jsonrpc: "2.0", id: "1", method: "getAccountInfo", params: [] } };

describe("devnet RPC retries", () => {
  it("retries a rate-limited request with the identical payload and honors Retry-After", async () => {
    let attempts = 0;
    const transport: RpcTransport = async (request) => {
      assert.equal(request, config);
      if (++attempts === 1) throw limited(429, "3");
      return { jsonrpc: "2.0", id: "1", result: "confirmed" } as never;
    };
    const started = Date.now();
    assert.deepEqual(await retryingTransport(transport)(config), { jsonrpc: "2.0", id: "1", result: "confirmed" });
    assert.equal(attempts, 2);
    assert.ok(Date.now() - started >= 2900);
  });

  it("stops after four attempts and preserves the original RPC error", async () => {
    let attempts = 0;
    const error = limited();
    const transport: RpcTransport = async () => { attempts++; throw error; };
    await assert.rejects(retryingTransport(transport)(config), (caught) => caught === error);
    assert.equal(attempts, 4);
  });

  it("does not retry other HTTP or program errors", async () => {
    for (const error of [limited(403), limited(500), new Error("simulation failed")]) {
      let attempts = 0;
      const transport: RpcTransport = async () => { attempts++; throw error; };
      await assert.rejects(retryingTransport(transport)(config), (caught) => caught === error);
      assert.equal(attempts, 1);
    }
  });

  it("does not retry earlier than an excessive Retry-After delay", async () => {
    for (const header of ["60", new Date(Date.now() + 60_000).toUTCString()]) {
      const error = limited(429, header);
      let attempts = 0;
      const transport: RpcTransport = async () => { attempts++; throw error; };
      await assert.rejects(retryingTransport(transport)(config), (caught) => caught === error);
      assert.equal(attempts, 1);
    }
  });

  it("cancels a retry delay without sending another request", async () => {
    const controller = new AbortController();
    let attempts = 0;
    const transport: RpcTransport = async () => { attempts++; controller.abort(); throw limited(); };
    await assert.rejects(retryingTransport(transport)({ ...config, signal: controller.signal }), { name: "AbortError" });
    assert.equal(attempts, 1);
  });

  it("never sends an already aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const transport: RpcTransport = async () => { assert.fail("aborted request sent"); };
    await assert.rejects(retryingTransport(transport)({ ...config, signal: controller.signal }), { name: "AbortError" });
  });
});
