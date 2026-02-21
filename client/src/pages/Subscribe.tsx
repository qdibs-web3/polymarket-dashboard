import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { SubscriptionFlow } from "../components/SubscriptionFlow";
import { useSubscription } from "../hooks/useSubscription";

const tiers = [
  {
    id: 1,
    name: "Basic",
    price: 60,
    description: "Perfect for getting started with automated trading",
    features: [
      "Access to core bot strategies",
      "Limited number of markets / pairs",
      "Lower execution frequency",
      "Basic analytics / reporting",
      "Community support / Discord",
    ],
    limits: {
      maxTradeSize: "$100",
      dailyLimit: "$1,000",
    },
    popular: false,
  },
  {
    id: 2,
    name: "Pro",
    price: 150,
    description: "For serious traders who need more power",
    features: [
      "Full strategy access",
      "Higher execution limits / speed",
      "Advanced analytics & metrics",
      "Priority execution / queueing",
      "Priority support",
      "Risk management controls",
    ],
    limits: {
      maxTradeSize: "$500",
      dailyLimit: "$5,000",
    },
    popular: true,
  },
  {
    id: 3,
    name: "Premium",
    price: 300,
    description: "Maximum performance for professional traders",
    features: [
      "Highest execution priority / limits",
      "Advanced strategies & experimental features",
      "Custom configuration / tuning",
      "API access / automation hooks",
      "Dedicated support / faster response",
      "Early feature access",
    ],
    limits: {
      maxTradeSize: "$10,000",
      dailyLimit: "$100,000",
    },
    popular: false,
  },
];

export default function Subscribe() {
  const { address, isConnected } = useAccount();
  const [, setLocation] = useLocation();
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [showPaymentFlow, setShowPaymentFlow] = useState(false);
  
  const { isSubscribed, isLoading } = useSubscription(address);

  // Redirect if already subscribed
  useEffect(() => {
    if (isConnected && !isLoading && isSubscribed) {
      setLocation("/dashboard");
    }
  }, [isConnected, isSubscribed, isLoading, setLocation]);

  const handleSubscribe = (tierId: number) => {
    if (!isConnected) {
      // Show connect wallet message
      return;
    }
    setSelectedTier(tierId);
    setShowPaymentFlow(true);
  };

  const handlePaymentComplete = () => {
    setShowPaymentFlow(false);
    setLocation("/dashboard");
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-[#18181b] border-[#27272a]">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Connect Your Wallet</CardTitle>
            <CardDescription className="text-center">
              Please connect your wallet to view subscription options
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16 space-y-4">
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            15-Minute Bitcoin Trading Bot
          </Badge>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Choose Your Trading Plan
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Automated Bitcoin trading on Polymarket. Non-custodial, secure, and profitable.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              className={`relative bg-[#18181b] border-[#27272a] hover:border-blue-500/50 transition-all duration-300 flex flex-col ${
                tier.popular ? "ring-2 ring-blue-500 scale-105" : ""
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white">Most Popular</Badge>
                </div>
              )}

              <CardHeader>
                <div className="h-6 flex items-center">
                  {tier.popular && (
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Popular</span>
                  )}
                </div>
                <CardTitle className="text-2xl">{tier.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-bold">${tier.price}</span>
                  <span className="text-gray-400 text-sm"> USDC / month</span>
                </div>
                <CardDescription className="text-gray-400 text-sm pt-1">
                  {tier.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div className="space-y-2">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-[#27272a] space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Max Trade Size:</span>
                    <span className="text-white font-medium">{tier.limits.maxTradeSize}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Daily Limit:</span>
                    <span className="text-white font-medium">{tier.limits.dailyLimit}</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="mt-auto pt-4">
                <Button
                  className="w-full"
                  variant={tier.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(tier.id)}
                >
                  Subscribe to {tier.name}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Features Section */}
        <div className="mt-24 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Our Bot?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle>Non-Custodial</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Your funds stay in your wallet. The bot only has permission to trade, never to withdraw.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle>15-Minute Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Proven technical analysis strategy that evaluates Bitcoin markets every 15 minutes.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle>Risk Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  Configure your own position sizes and daily limits. Full control over your risk exposure.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-[#18181b] border-[#27272a]">
              <CardHeader>
                <CardTitle>Real-Time Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-400">
                  See every decision the bot makes with detailed logs and performance metrics.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Flow Modal */}
      {showPaymentFlow && selectedTier && (
        <SubscriptionFlow
          tier={selectedTier}
          onComplete={handlePaymentComplete}
          onCancel={() => setShowPaymentFlow(false)}
        />
      )}
    </div>
  );
}