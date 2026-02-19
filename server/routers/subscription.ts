import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { ethers } from "ethers";

// Subscription contract ABI (minimal for reading)
const SUBSCRIPTION_ABI = [
  "function getSubscription(address user) external view returns (uint8 tier, uint256 expiresAt, uint256 lastPayment, bool isActive, bool isExpired)",
  "function hasActiveSubscription(address user) external view returns (bool)",
  "function getTierPrice(uint8 tier) external pure returns (uint256)",
];

// Contract addresses (update after deployment)
const SUBSCRIPTION_CONTRACT = process.env.SUBSCRIPTION_CONTRACT_ADDRESS || "";
const POLYGON_RPC = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";

// Tier enum matching smart contract
enum Tier {
  NONE = 0,
  BASIC = 1,
  PRO = 2,
  PREMIUM = 3,
}

export const subscriptionRouter = router({
  /**
   * Get subscription status for a wallet address
   */
  getStatus: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        if (!SUBSCRIPTION_CONTRACT) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Subscription contract not configured",
          });
        }

        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const contract = new ethers.Contract(
          SUBSCRIPTION_CONTRACT,
          SUBSCRIPTION_ABI,
          provider
        );

        const subscription = await contract.getSubscription(input.walletAddress);

        return {
          tier: Number(subscription[0]), // tier
          tierName: getTierName(Number(subscription[0])),
          expiresAt: new Date(Number(subscription[1]) * 1000), // expiresAt
          lastPayment: new Date(Number(subscription[2]) * 1000), // lastPayment
          isActive: subscription[3], // isActive
          isExpired: subscription[4], // isExpired
        };
      } catch (error: any) {
        console.error("[Subscription] Error getting status:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get subscription status",
        });
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
          priceUSDC: "60000000", // 60 USDC (6 decimals)
          duration: 30,
          features: [
            "Access to core bot strategies",
            "Limited number of markets / pairs",
            "Lower execution frequency or rate limits",
            "Basic analytics / reporting",
            "Community support / Discord",
          ],
          limits: {
            maxTradeSize: 100,
            dailyLimit: 1000,
          },
        },
        {
          id: Tier.PRO,
          name: "Pro",
          price: 150,
          priceUSDC: "150000000", // 150 USDC (6 decimals)
          duration: 30,
          features: [
            "Full strategy access",
            "Higher execution limits / speed",
            "Advanced analytics & metrics",
            "Priority execution / queueing",
            "Priority support",
            "Risk management controls",
          ],
          limits: {
            maxTradeSize: 500,
            dailyLimit: 5000,
          },
        },
        {
          id: Tier.PREMIUM,
          name: "Premium",
          price: 300,
          priceUSDC: "300000000", // 300 USDC (6 decimals)
          duration: 30,
          features: [
            "Highest execution priority / limits",
            "Advanced strategies or experimental features",
            "Custom configuration / tuning",
            "API access / automation hooks",
            "Dedicated support / faster response",
            "Early feature access",
          ],
          limits: {
            maxTradeSize: 10000,
            dailyLimit: 100000,
          },
        },
      ],
      usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon USDC
      subscriptionContract: SUBSCRIPTION_CONTRACT,
    };
  }),

  /**
   * Verify subscription transaction
   */
  verifyTransaction: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
        txHash: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
        const receipt = await provider.getTransactionReceipt(input.txHash);

        if (!receipt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Transaction not found",
          });
        }

        if (receipt.status !== 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Transaction failed",
          });
        }

        // Log transaction in database
        await db.logSubscriptionTransaction({
          walletAddress: input.walletAddress,
          txHash: input.txHash,
          status: "confirmed",
          timestamp: new Date(),
        });

        return {
          success: true,
          blockNumber: receipt.blockNumber,
          confirmations: await receipt.confirmations(),
        };
      } catch (error: any) {
        console.error("[Subscription] Error verifying transaction:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message || "Failed to verify transaction",
        });
      }
    }),

  /**
   * Get subscription history
   */
  getHistory: publicProcedure
    .input(
      z.object({
        walletAddress: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const history = await db.getSubscriptionHistory(input.walletAddress);
        return history;
      } catch (error: any) {
        console.error("[Subscription] Error getting history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get subscription history",
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