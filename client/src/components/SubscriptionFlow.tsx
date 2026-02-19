import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useUSDCBalance } from "@/hooks/useUSDCBalance";
import USDC_ABI from "@/contracts/USDC.json";
import SUBSCRIPTION_ABI from "@/contracts/SubscriptionManager.json";

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `0x${string}`;
const SUBSCRIPTION_CONTRACT = import.meta.env.VITE_SUBSCRIPTION_CONTRACT as `0x${string}`;

const TIER_PRICES = {
  1: "60", // Basic
  2: "150", // Pro
  3: "300", // Premium
};

const TIER_NAMES = {
  1: "Basic",
  2: "Pro",
  3: "Premium",
};

type Step = "approve" | "subscribe" | "verify" | "complete" | "error";

interface SubscriptionFlowProps {
  tier: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function SubscriptionFlow({ tier, onComplete, onCancel }: SubscriptionFlowProps) {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>("approve");
  const [error, setError] = useState<string | null>(null);
  
  const { balance, balanceRaw } = useUSDCBalance(address);
  const price = TIER_PRICES[tier as keyof typeof TIER_PRICES];
  const tierName = TIER_NAMES[tier as keyof typeof TIER_NAMES];
  const priceUSDC = parseUnits(price, 6); // USDC has 6 decimals

  // Approve USDC spending
  const { writeContract: approveUSDC, data: approveHash } = useWriteContract();
  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Subscribe
  const { writeContract: subscribe, data: subscribeHash } = useWriteContract();
  const { isLoading: isSubscribing, isSuccess: subscribeSuccess } = useWaitForTransactionReceipt({
    hash: subscribeHash,
  });

  // Verify transaction
  const verifyMutation = trpc.subscription.verifyTransaction.useMutation();

  const handleApprove = async () => {
    try {
      setError(null);
      
      // Check balance
      if (!balanceRaw || balanceRaw < priceUSDC) {
        setError(`Insufficient USDC balance. You need ${price} USDC but have ${balance} USDC.`);
        return;
      }

      approveUSDC({
        address: USDC_ADDRESS,
        abi: USDC_ABI.abi,
        functionName: "approve",
        args: [SUBSCRIPTION_CONTRACT, priceUSDC],
      });
    } catch (err: any) {
      setError(err.message || "Failed to approve USDC");
      setStep("error");
    }
  };

  const handleSubscribe = async () => {
    try {
      setError(null);
      setStep("subscribe");

      subscribe({
        address: SUBSCRIPTION_CONTRACT,
        abi: SUBSCRIPTION_ABI.abi,
        functionName: "subscribe",
        args: [tier],
      });
    } catch (err: any) {
      setError(err.message || "Failed to subscribe");
      setStep("error");
    }
  };

  const handleVerify = async () => {
    try {
      setError(null);
      setStep("verify");

      if (!subscribeHash || !address) {
        throw new Error("Missing transaction hash or address");
      }

      await verifyMutation.mutateAsync({
        walletAddress: address,
        txHash: subscribeHash,
      });

      setStep("complete");
      setTimeout(onComplete, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to verify transaction");
      setStep("error");
    }
  };

  // Auto-advance steps
  if (approveSuccess && step === "approve") {
    handleSubscribe();
  }

  if (subscribeSuccess && step === "subscribe") {
    handleVerify();
  }

  const getStepStatus = (currentStep: Step) => {
    const steps: Step[] = ["approve", "subscribe", "verify", "complete"];
    const currentIndex = steps.indexOf(step);
    const stepIndex = steps.indexOf(currentStep);

    if (stepIndex < currentIndex) return "complete";
    if (stepIndex === currentIndex) return "active";
    return "pending";
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="bg-[#18181b] border-[#27272a] text-white">
        <DialogHeader>
          <DialogTitle>Subscribe to {tierName} Plan</DialogTitle>
          <DialogDescription className="text-gray-400">
            Complete the following steps to activate your subscription
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Step 1: Approve */}
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              getStepStatus("approve") === "complete" ? "bg-green-500" :
              getStepStatus("approve") === "active" ? "bg-blue-500" :
              "bg-gray-700"
            }`}>
              {getStepStatus("approve") === "complete" ? (
                <Check className="h-4 w-4" />
              ) : getStepStatus("approve") === "active" && isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>1</span>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Approve USDC</h4>
              <p className="text-sm text-gray-400">
                Allow the contract to spend {price} USDC
              </p>
            </div>
          </div>

          {/* Step 2: Subscribe */}
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              getStepStatus("subscribe") === "complete" ? "bg-green-500" :
              getStepStatus("subscribe") === "active" ? "bg-blue-500" :
              "bg-gray-700"
            }`}>
              {getStepStatus("subscribe") === "complete" ? (
                <Check className="h-4 w-4" />
              ) : getStepStatus("subscribe") === "active" && isSubscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>2</span>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Confirm Subscription</h4>
              <p className="text-sm text-gray-400">
                Sign the transaction to activate your plan
              </p>
            </div>
          </div>

          {/* Step 3: Verify */}
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              getStepStatus("verify") === "complete" ? "bg-green-500" :
              getStepStatus("verify") === "active" ? "bg-blue-500" :
              "bg-gray-700"
            }`}>
              {getStepStatus("verify") === "complete" ? (
                <Check className="h-4 w-4" />
              ) : getStepStatus("verify") === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>3</span>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Verify Payment</h4>
              <p className="text-sm text-gray-400">
                Confirming your subscription on-chain
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Balance Display */}
          <div className="bg-[#27272a] rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Your USDC Balance:</span>
              <span className="font-medium">{balance} USDC</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-400">Subscription Cost:</span>
              <span className="font-medium">{price} USDC</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          {step === "approve" && (
            <>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={isApproving}>
                {isApproving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve USDC"
                )}
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button onClick={onComplete} className="w-full">
              <Check className="mr-2 h-4 w-4" />
              Subscription Active!
            </Button>
          )}

          {step === "error" && (
            <>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={() => setStep("approve")}>
                Try Again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}