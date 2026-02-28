/**
 * One-time script to derive Polymarket CLOB API credentials from your bot wallet.
 *
 * Run once:
 *   BOT_PRIVATE_KEY=0x... npx tsx scripts/derive-creds.mts
 *
 * Then paste the output into your .env file.
 */

import { ClobClient } from "@polymarket/clob-client";

// Import ethers v5 directly from the clob-client's own bundled copy
// to avoid the ethers v5/v6 version conflict in the project
// @ts-ignore — intentional: resolving clob-client's internal ethers v5
import { Wallet, providers } from "@polymarket/clob-client/node_modules/ethers/lib/ethers.js";

const key = process.env.BOT_PRIVATE_KEY;
if (!key) {
  console.error("❌  BOT_PRIVATE_KEY is not set.");
  console.error("    Usage: BOT_PRIVATE_KEY=0x... npx tsx scripts/derive-creds.mts");
  process.exit(1);
}

const provider = new providers.JsonRpcProvider("https://polygon-rpc.com", 137);
const signer   = new Wallet(key, provider);

console.log(`\nDeriving CLOB credentials for wallet: ${signer.address}`);
console.log("Connecting to clob.polymarket.com...\n");

// Cast to any to bypass the Wallet type mismatch between ethers v5 and v6
const client = new ClobClient("https://clob.polymarket.com", 137, signer as any);
const creds  = await client.createOrDeriveApiKey() as any;

const apiKey     = creds.key ?? creds.apiKey ?? "";
const secret     = creds.secret ?? "";
const passphrase = creds.passphrase ?? "";

if (!apiKey || !secret || !passphrase) {
  console.error("❌  Credential derivation returned incomplete data:", creds);
  process.exit(1);
}

console.log("✅  Credentials derived successfully. Add these to your .env file:\n");
console.log(`CLOB_API_KEY=${apiKey}`);
console.log(`CLOB_SECRET=${secret}`);
console.log(`CLOB_PASSPHRASE=${passphrase}`);
console.log("\nDone.");
