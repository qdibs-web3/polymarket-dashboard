import { useUser, useClerk } from "@clerk/clerk-react";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export function useAuth() {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const syncUserMutation = trpc.auth.syncUser.useMutation();
  
  // Fetch user12 from database (includes subscription info)
  // Wait for sync to complete before fetching
  const { data: dbUser } = trpc.auth.me.useQuery(undefined, {
    enabled: isSignedIn && syncUserMutation.isSuccess,
    retry: false,
  });

  // Sync user to database when authenticated
  useEffect(() => {
    if (isSignedIn && clerkUser && !syncUserMutation.isSuccess && !syncUserMutation.isPending) {
      syncUserMutation.mutate({
        userId: clerkUser.id,
        name: clerkUser.fullName || clerkUser.username || undefined,
        email: clerkUser.primaryEmailAddress?.emailAddress || undefined,
      });
    }
  }, [isSignedIn, clerkUser?.id]);

  // Use database user (has subscription info) or fallback to Clerk user
  const mappedUser = dbUser || (clerkUser ? {
    id: 1,
    openId: clerkUser.id,
    name: clerkUser.fullName || clerkUser.username || "User",
    email: clerkUser.primaryEmailAddress?.emailAddress || "",
    loginMethod: "clerk",
    role: "user" as const,
    subscriptionTier: "none" as const,
    subscriptionStatus: "none" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  } : null);

  const logout = async () => {
    await signOut();
  };

  return {
    user: mappedUser,
    loading: !isLoaded,
    error: null,
    isAuthenticated: isSignedIn || false,
    logout,
    refresh: () => Promise.resolve(),
  };
}