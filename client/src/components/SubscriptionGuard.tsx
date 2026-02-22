import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps pages that require an active subscription.
 * Redirects unsubscribed users to /subscribe.
 */
export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { address, isConnected } = useAccount();
  const [, setLocation] = useLocation();

  const { data: subscription, isLoading } = trpc.subscription.getStatus.useQuery(
    { walletAddress: address! },
    { enabled: !!address && isConnected }
  );

  const isSubscribed = subscription?.isActive ?? false;

  useEffect(() => {
    if (!isLoading && !isSubscribed && isConnected) {
      setLocation("/subscribe");
    }
  }, [isLoading, isSubscribed, isConnected, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isSubscribed) {
    return null; // Will redirect
  }

  return <>{children}</>;
}