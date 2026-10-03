import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createSolanaRpcFromTransport, generateKeyPairSigner } from '@solana/kit';
import { sendInstructions } from '../lib/settlement.js';
import { ProofError } from '../lib/proof-error.js';

function rpcFixture(fundingFailure = false) {
  const sent: string[] = [];
  const rpc = createSolanaRpcFromTransport(async ({ payload }) => {
    const { method, params, id } = payload as { method: string; params: unknown[]; id: string };
    const config = params[1] as Record<string, unknown>;
    sent.push(method);
    let result: unknown;
    if (method === 'getLatestBlockhash') {
      assert.equal((params[0] as Record<string, unknown>).commitment, 'confirmed');
      result = { context: { slot: 1 }, value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 100 } };
    } else if (method === 'simulateTransaction') {
      assert.equal(config.commitment, 'confirmed');
      assert.equal(config.sigVerify, true);
      result = { context: { slot: 1 }, value: { err: fundingFailure ? { InstructionError: [0, { Custom: 1 }] } : null,
        logs: fundingFailure ? ['Transfer: insufficient lamports 1941320, need 2742240'] : [] } };
    } else if (method === 'sendTransaction') {
      assert.equal(config.preflightCommitment, 'confirmed');
      result = '1'.repeat(64);
    } else if (method === 'getSignatureStatuses') {
      result = { context: { slot: 1 }, value: [{ err: null, confirmationStatus: 'confirmed', slot: 1, confirmations: 1 }] };
    } else throw new Error(`Unexpected ${method}`);
    return { jsonrpc: '2.0', id, result } as never;
  });
  return { rpc, sent };
}

it('matches confirmed blockhash, signature verification and preflight commitment', async () => {
  const { rpc, sent } = rpcFixture();
  const signature = await sendInstructions(rpc, await generateKeyPairSigner(), []);
  assert.ok(signature.length > 50);
  assert.deepEqual(sent, ['getLatestBlockhash', 'simulateTransaction', 'sendTransaction', 'getSignatureStatuses']);
});

it('reports service funding shortage without broadcasting a failing attestation', async () => {
  const { rpc, sent } = rpcFixture(true);
  await assert.rejects(sendInstructions(rpc, await generateKeyPairSigner(), []),
    (e: unknown) => e instanceof ProofError && e.code === 'review_funding_unavailable' && e.status === 503);
  assert.ok(!sent.includes('sendTransaction'));
});
