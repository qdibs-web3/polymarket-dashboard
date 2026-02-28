import { useBalance } from "wagmi";
import { polygon } from "wagmi/chains";

/**
 * Bridged USDC.e on Polygon Mainnet — the collateral token used by Polymarket.
 * MetaMask shows this as "USD Coin (PoS)" with address 0x2791...
 *
 * NOTE: Polymarket's CTF Exchange and NegRisk Adapter settle in USDC.e,
 * NOT in native USDC (0x3c499c...). Always display and use USDC.e balance.
 *
 * VITE_USDC_ADDRESS can override this for testnet deployments.
 */
const POLYGON_MAINNET_USDC = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

const USDC_TOKEN_ADDRESS = (
  (import.meta.env.VITE_USDC_ADDRESS as string | undefined) || POLYGON_MAINNET_USDC
) as `0x${string}`;

export function useUSDCBalance(address: string | undefined) {
  /**
   * wagmi's useBalance with `token` reads ERC-20 balanceOf under the hood.
   * Passing `chainId: polygon.id` forces it to always query Polygon Mainnet
   * regardless of which chain the wallet is currently connected to.
   */
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useBalance({
    address: address as `0x${string}` | undefined,
    token: USDC_TOKEN_ADDRESS,
    chainId: polygon.id, // Always read from Polygon Mainnet (137)
    query: {
      enabled: !!address,
      refetchInterval: 15_000,
      retry: 3,
    },
  });

  if (isError && error) {
    console.warn("[useUSDCBalance] Balance fetch failed:", error.message);
    console.warn("[useUSDCBalance] Token address:", USDC_TOKEN_ADDRESS);
    console.warn("[useUSDCBalance] Wallet address:", address);
  }

  // data.value is a bigint; data.formatted is already the human-readable string
  const balance = data?.formatted ?? "0";
  const balanceRaw = data?.value;

  return {
    balance,
    balanceRaw,
    decimals: data?.decimals ?? 6,
    symbol: data?.symbol ?? "USDC",
    isLoading,
    isError,
    refetch,
    usdcAddress: USDC_TOKEN_ADDRESS,
  };
}