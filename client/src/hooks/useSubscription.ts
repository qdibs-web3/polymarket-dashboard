import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";

export function useSubscription(walletAddress: string | undefined) {
  const { data, isLoading, error, refetch } = trpc.subscription.getStatus.useQuery(
    { walletAddress: walletAddress || "" },
    {
      enabled: !!walletAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const isSubscribed = data?.isActive && !data?.isExpired;
  const isExpiringSoon = data?.expiresAt
    ? new Date(data.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 // 3 days
    : false;

  return {
    subscriptionStatus: data,
    isSubscribed,
    isExpiringSoon,
    isLoading,
    error,
    refetch,
  };
}