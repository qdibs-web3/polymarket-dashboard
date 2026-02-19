import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import USDC_ABI from "@/contracts/USDC.json";

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`;

export function useUSDCBalance(address: string | undefined) {
  const { data: balanceRaw, isLoading, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI.abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refetch every 10 seconds
    },
  });

  const balance = balanceRaw ? formatUnits(balanceRaw as bigint, 6) : "0";

  return {
    balance,
    balanceRaw: balanceRaw as bigint | undefined,
    isLoading,
    refetch,
  };
}