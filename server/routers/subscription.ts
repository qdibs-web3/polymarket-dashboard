import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { ethers } from "ethers";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Subscription contract ABI (minimal for reading)
const SUBSCRIPTION_ABI = [
  "function getSubscription(address user) external view returns (uint8 tier, uint256 expiresAt, uint256 lastPayment, bool isActive, bool isExpired)",
  "function hasActiveSubscription(address user) external view returns (bool)",
  "function getTierPrice(uint8 tier) external pure returns (uint256)",
];

// Contract addresses and RPC — always Polygon Mainnet (chainId 137)
// The subscription contract is deployed on Polygon Mainnet.
// Set SUBSCRIPTION_CONTRACT_ADDRESS and POLYGON_RPC_URL in your .env
const SUBSCRIPTION_CONTRACT = process.env.SUBSCRIPTION_CONTRACT_ADDRESS || "";

const POLYGON_RPC =
  process.env.POLYGON_RPC_URL ||
  "https://polygon-bor-rpc.publicnode.com";

// Always Polygon Mainnet
const NETWORK_CONFIG = ethers.Network.from({ chainId: 137, name: "polygon" });

// Default no-subscription response
const NO_SUBSCRIPTION = {
  tier: 0,
  tierName: "None",
  expiresAt: null,
  lastPayment: null,
  isActive: false,
  isExpired: false,
};

// Tier enum matching smart contract
enum Tier {
  NONE = 0,
  BASIC = 1,
  PRO = 2,
  PREMIUM = 3,
}

// Admin secret for the override endpoint — set ADMIN_SECRET in your .env
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

export const subscriptionRouter = router({
  /**
   * Get subscription status for a wallet address.
   * First checks the on-chain contract; falls back to the DB override flag.
   */
  getStatus: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
      })
    )
    .query(async ({ input }) => {
      // ── 1. Check DB override first ──────────────────────────────────────
      try {
        const database = await getDb();
        const rows = await database
          .select()
          .from(users)
          .where(eq(users.wallet_address, input.walletAddress.toLowerCase()))
          .limit(1);

        const user = rows[0];
        if (user && user.subscriptionStatus === "active") {
          const tierMap: Record<string, number> = {
            none: 0,
            basic: 1,
            pro: 2,
            enterprise: 3, // "enterprise" is used for premium in the DB enum
          };
          const tier = tierMap[user.subscriptionTier] ?? 0;
          const expiresAt = user.subscriptionEndDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          return {
            tier,
            tierName: getTierName(tier),
            expiresAt,
            lastPayment: user.subscriptionStartDate ?? null,
            isActive: true,
            isExpired: expiresAt < new Date(),
          };
        }
      } catch (dbError: any) {
        console.warn("[Subscription] DB override check failed:", dbError.message);
      }

      // ── 2. Fall back to on-chain contract ────────────────────────────────
      if (!SUBSCRIPTION_CONTRACT) {
        return NO_SUBSCRIPTION;
      }

      try {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC, NETWORK_CONFIG, {
          staticNetwork: NETWORK_CONFIG,
        });
        const contract = new ethers.Contract(SUBSCRIPTION_CONTRACT, SUBSCRIPTION_ABI, provider);

        const subscription = await contract.getSubscription(
          ethers.getAddress(input.walletAddress)
        );

        return {
          tier: Number(subscription[0]),
          tierName: getTierName(Number(subscription[0])),
          expiresAt: new Date(Number(subscription[1]) * 1000),
          lastPayment: new Date(Number(subscription[2]) * 1000),
          isActive: subscription[3],
          isExpired: subscription[4],
        };
      } catch (error: any) {
        console.error("[Subscription] Error getting status:", error.shortMessage || error.message);
        return NO_SUBSCRIPTION;
      }
    }),

  /**
   * Get tier pricing
   */
  getPricing: publicProcedure.query(async () => {
    return {
      tiers: [
        {
          id: Tier.BASIC,
          name: "Basic",
          price: 60,
          priceUSDC: "60000000",
          duration: 30,
          features: [
            "Access to core bot strategies",
            "Limited number of markets / pairs",
            "Lower execution frequency or rate limits",
            "Basic analytics / reporting",
            "Community support / Discord",
          ],
          limits: { maxTradeSize: 100, dailyLimit: 1000 },
        },
        {
          id: Tier.PRO,
          name: "Pro",
          price: 150,
          priceUSDC: "150000000",
          duration: 30,
          features: [
            "Full strategy access",
            "Higher execution limits / speed",
            "Advanced analytics & metrics",
            "Priority execution / queueing",
            "Priority support",
            "Risk management controls",
          ],
          limits: { maxTradeSize: 500, dailyLimit: 5000 },
        },
        {
          id: Tier.PREMIUM,
          name: "Premium",
          price: 300,
          priceUSDC: "300000000",
          duration: 30,
          features: [
            "Highest execution priority / limits",
            "Advanced strategies or experimental features",
            "Custom configuration / tuning",
            "API access / automation hooks",
            "Dedicated support / faster response",
            "Early feature access",
          ],
          limits: { maxTradeSize: 10000, dailyLimit: 100000 },
        },
      ],
      usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      subscriptionContract: SUBSCRIPTION_CONTRACT,
    };
  }),

  /**
   * Verify subscription transaction.
   *
   * Polygon blocks are ~2 s apart. The client calls this endpoint as soon as
   * wagmi's local RPC sees the receipt, but the server's RPC node may not have
   * propagated the block yet. We poll up to MAX_ATTEMPTS times with a short
   * delay before giving up, which eliminates the race condition.
   */
  verifyTransaction: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        txHash: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const MAX_ATTEMPTS = 12;   // 12 × 5 s = up to 60 s wait
      const POLL_INTERVAL = 5_000; // ms

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const provider = new ethers.JsonRpcProvider(POLYGON_RPC, NETWORK_CONFIG, {
        staticNetwork: NETWORK_CONFIG,
      });

      let receipt: ethers.TransactionReceipt | null = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          receipt = await provider.getTransactionReceipt(input.txHash);
        } catch (rpcErr: any) {
          console.warn(
            `[Subscription] RPC error on attempt ${attempt}/${MAX_ATTEMPTS}:`,
            rpcErr.shortMessage ?? rpcErr.message
          );
        }

        if (receipt) break;

        if (attempt < MAX_ATTEMPTS) {
          console.log(
            `[Subscription] Tx ${input.txHash.slice(0, 10)}... not found yet, ` +
            `retrying in ${POLL_INTERVAL / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`
          );
          await sleep(POLL_INTERVAL);
        }
      }

      if (!receipt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            "Transaction not found after 60 seconds. " +
            "It may still be pending — please wait a moment and try again.",
        });
      }

      if (receipt.status !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Transaction was reverted on-chain" });
      }

      // ── Parse SubscriptionPurchased event to get tier ──────────────────────
      // event SubscriptionPurchased(address indexed user, Tier tier, uint256 amount, uint256 expiresAt)
      const PURCHASED_TOPIC = ethers.id("SubscriptionPurchased(address,uint8,uint256,uint256)");
      let parsedTier: number = 1; // default to BASIC
      let parsedExpiresAt: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      for (const log of receipt.logs) {
        if (log.topics[0] === PURCHASED_TOPIC) {
          try {
            // topics[1] = indexed user address, topics[2] = tier (uint8)
            parsedTier = Number(ethers.toBigInt(log.topics[2]));
            // data = abi.encode(amount, expiresAt)
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
              ["uint256", "uint256"],
              log.data
            );
            parsedExpiresAt = new Date(Number(decoded[1]) * 1000);
          } catch (parseErr: any) {
            console.warn("[Subscription] Could not parse event log:", parseErr.message);
          }
          break;
        }
      }

      const tierNameMap: Record<number, string> = { 1: "basic", 2: "pro", 3: "enterprise" };
      const tierName = tierNameMap[parsedTier] ?? "basic";
      const walletLower = input.walletAddress.toLowerCase();
      const now = new Date();

      // ── Update users table ─────────────────────────────────────────────────
      try {
        const database = await getDb();

        const existing = await database
          .select()
          .from(users)
          .where(eq(users.wallet_address, walletLower))
          .limit(1);

        if (existing.length === 0) {
          const { nanoid } = await import("nanoid");
          await database.insert(users).values({
            wallet_address: walletLower,
            nonce: nanoid(32),
            subscriptionTier: tierName as any,
            subscriptionStatus: "active",
            subscriptionStartDate: now,
            subscriptionEndDate: parsedExpiresAt,
          });
        } else {
          await database
            .update(users)
            .set({
              subscriptionTier: tierName as any,
              subscriptionStatus: "active",
              subscriptionStartDate: now,
              subscriptionEndDate: parsedExpiresAt,
            })
            .where(eq(users.wallet_address, walletLower));
        }

        console.log(
          `[Subscription] Activated ${tierName} for ${walletLower} until ${parsedExpiresAt.toISOString()}`
        );
      } catch (dbErr: any) {
        // Non-fatal — log but don't fail the verify response
        console.error("[Subscription] DB update failed:", dbErr.message);
      }

      // ── Log transaction record ─────────────────────────────────────────────
      try {
        await db.logSubscriptionTransaction({
          walletAddress: input.walletAddress,
          txHash: input.txHash,
          status: "confirmed",
          timestamp: now,
        });
      } catch (dbErr: any) {
        console.warn("[Subscription] Could not log transaction to DB:", (dbErr as any).message);
      }

      return {
        success: true,
        tier: parsedTier,
        tierName,
        expiresAt: parsedExpiresAt,
        blockNumber: receipt.blockNumber,
        confirmations: await receipt.confirmations(),
      };
    }),

  /**
   * Get subscription history
   */
  getHistory: publicProcedure
    .input(z.object({ walletAddress: z.string() }))
    .query(async ({ input }) => {
      try {
        return await db.getSubscriptionHistory(input.walletAddress);
      } catch (error: any) {
        console.error("[Subscription] Error getting history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get subscription history",
        });
      }
    }),

  /**
   * Admin override — manually activate a subscription in TiDB.
   *
   * Usage (curl example):
   *   POST /api/trpc/subscription.adminOverride
   *   Body: { adminSecret: "<ADMIN_SECRET>", walletAddress: "0x...", tier: "pro", durationDays: 30 }
   *
   * Set ADMIN_SECRET in your server .env to protect this endpoint.
   */
  adminOverride: publicProcedure
    .input(
      z.object({
        adminSecret: z.string(),
        walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/i),
        tier: z.enum(["basic", "pro", "enterprise"]).default("pro"),
        durationDays: z.number().min(1).max(365).default(30),
      })
    )
    .mutation(async ({ input }) => {
      // Validate admin secret
      if (!ADMIN_SECRET || input.adminSecret !== ADMIN_SECRET) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid admin secret" });
      }

      const walletAddress = input.walletAddress.toLowerCase();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

      try {
        const database = await getDb();

        // Upsert user if not already in DB
        const existing = await database
          .select()
          .from(users)
          .where(eq(users.wallet_address, walletAddress))
          .limit(1);

        if (existing.length === 0) {
          // Create a minimal user record
          const { nanoid } = await import("nanoid");
          await database.insert(users).values({
            wallet_address: walletAddress,
            nonce: nanoid(32),
            subscriptionTier: input.tier,
            subscriptionStatus: "active",
            subscriptionStartDate: now,
            subscriptionEndDate: expiresAt,
          });
        } else {
          await database
            .update(users)
            .set({
              subscriptionTier: input.tier,
              subscriptionStatus: "active",
              subscriptionStartDate: now,
              subscriptionEndDate: expiresAt,
            })
            .where(eq(users.wallet_address, walletAddress));
        }

        console.log(
          `[AdminOverride] Set ${walletAddress} to ${input.tier} until ${expiresAt.toISOString()}`
        );

        return {
          success: true,
          walletAddress,
          tier: input.tier,
          expiresAt,
          message: `Subscription activated for ${walletAddress} (${input.tier}) until ${expiresAt.toDateString()}`,
        };
      } catch (error: any) {
        console.error("[AdminOverride] Error:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to set subscription",
        });
      }
    }),
});

function getTierName(tier: number): string {
  switch (tier) {
    case Tier.BASIC:
      return "Basic";
    case Tier.PRO:
      return "Pro";
    case Tier.PREMIUM:
      return "Premium";
    default:
      return "None";
  }
}