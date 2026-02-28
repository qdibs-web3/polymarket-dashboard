/**
 * One-time script to approve USDC for the Polymarket CTF Exchange on Polygon.
 * This replaces the "Deposit" step on the Polymarket website.
 *
 * Run once:
 *   BOT_PRIVATE_KEY=0x... npx tsx scripts/approve-usdc.mts
 *
 * Requirements:
 *   - Wallet must have USDC on Polygon (native USDC: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)
 *   - Wallet must have a small amount of POL/MATIC for gas (~0.01 POL is enough)
 */

import { ethers } from "ethers";

// ─── Polygon contract addresses ────────────────────────────────────────────
// Multiple free RPCs with fallback (polygon-rpc.com is rate-limited)
const POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://1rpc.io/matic',
  'https://polygon.drpc.org',
];
const USDC_NATIVE     = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // Native USDC on Polygon
const USDC_BRIDGED    = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Bridged USDC.e on Polygon
const CTF_EXCHANGE    = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // Polymarket CTF Exchange
const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"; // Polymarket Neg Risk Adapter

const MAX_UINT256 = ethers.MaxUint256;

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// ─── Main ───────────────────────────────────────────────────────────────────
const key = process.env.BOT_PRIVATE_KEY;
if (!key) {
  console.error("❌  BOT_PRIVATE_KEY is not set.");
  console.error("    Usage: BOT_PRIVATE_KEY=0x... npx tsx scripts/approve-usdc.mts");
  process.exit(1);
}

// Try each RPC until one connects
let provider!: ethers.JsonRpcProvider;
for (const rpc of POLYGON_RPCS) {
  try {
    const p = new ethers.JsonRpcProvider(rpc, 137, { staticNetwork: true });
    await p.getBlockNumber();
    provider = p;
    console.log(`RPC: ${rpc}`);
    break;
  } catch {
    console.log(`  ${rpc} failed, trying next...`);
  }
}
if (!provider!) {
  console.error('❌  All Polygon RPCs failed. Try again in a moment.');
  process.exit(1);
}

const wallet = new ethers.Wallet(key, provider);

console.log(`\nWallet: ${wallet.address}`);
console.log('Network: Polygon\n');

// Check balances
const polBalance  = await provider.getBalance(wallet.address);
console.log(`POL balance: ${ethers.formatEther(polBalance)} POL`);

const usdcNative  = new ethers.Contract(USDC_NATIVE,  ERC20_ABI, wallet);
const usdcBridged = new ethers.Contract(USDC_BRIDGED, ERC20_ABI, wallet);

const nativeBal  = await usdcNative.balanceOf(wallet.address);
const bridgedBal = await usdcBridged.balanceOf(wallet.address);
console.log(`Native USDC balance:   ${ethers.formatUnits(nativeBal,  6)} USDC`);
console.log(`Bridged USDC.e balance: ${ethers.formatUnits(bridgedBal, 6)} USDC.e`);

if (polBalance === 0n) {
  console.error("\n❌  No POL for gas. Send at least 0.1 POL to this wallet on Polygon first.");
  process.exit(1);
}

if (nativeBal === 0n && bridgedBal === 0n) {
  console.error("\n❌  No USDC found. Send USDC to this wallet on Polygon first.");
  process.exit(1);
}

// Determine which USDC to approve
const useNative = nativeBal > 0n;
const usdc      = useNative ? usdcNative : usdcBridged;
const usdcLabel = useNative ? "Native USDC" : "Bridged USDC.e";
const usdcBal   = useNative ? nativeBal : bridgedBal;

console.log(`\nUsing: ${usdcLabel} (${ethers.formatUnits(usdcBal, 6)} USDC)`);

// Check existing allowances
const ctfAllowance       = await usdc.allowance(wallet.address, CTF_EXCHANGE);
const negRiskAllowance   = await usdc.allowance(wallet.address, NEG_RISK_ADAPTER);

console.log(`\nCurrent allowances:`);
console.log(`  CTF Exchange:      ${ctfAllowance === MAX_UINT256 ? "MAX (already approved)" : ethers.formatUnits(ctfAllowance, 6) + " USDC"}`);
console.log(`  Neg Risk Adapter:  ${negRiskAllowance === MAX_UINT256 ? "MAX (already approved)" : ethers.formatUnits(negRiskAllowance, 6) + " USDC"}`);

// Approve CTF Exchange if needed
if (ctfAllowance < usdcBal) {
  console.log(`\nApproving CTF Exchange to spend ${usdcLabel}...`);
  const tx1 = await usdc.approve(CTF_EXCHANGE, MAX_UINT256);
  console.log(`  TX sent: ${tx1.hash}`);
  console.log(`  Waiting for confirmation...`);
  await tx1.wait();
  console.log(`  ✅ CTF Exchange approved`);
} else {
  console.log(`\n✅ CTF Exchange already approved — skipping`);
}

// Approve Neg Risk Adapter if needed (required for some market types)
if (negRiskAllowance < usdcBal) {
  console.log(`\nApproving Neg Risk Adapter to spend ${usdcLabel}...`);
  const tx2 = await usdc.approve(NEG_RISK_ADAPTER, MAX_UINT256);
  console.log(`  TX sent: ${tx2.hash}`);
  console.log(`  Waiting for confirmation...`);
  await tx2.wait();
  console.log(`  ✅ Neg Risk Adapter approved`);
} else {
  console.log(`✅ Neg Risk Adapter already approved — skipping`);
}

console.log(`\n✅ All approvals complete. Your bot wallet is ready to trade on Polymarket.`);
console.log(`   Start the bot and it will execute trades on the next market close.\n`);
