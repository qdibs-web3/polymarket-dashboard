import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TIERS = [
  {
    id: 'basic' as const,
    name: 'Basic',
    price: 20,
    description: 'Perfect for getting started',
    features: [
      '5 max open positions',
      '$300 max position size',
      'Arbitrage strategy only',
      'Email support',
    ],
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 99,
    description: 'For serious traders',
    features: [
      '15 max open positions',
      '$1,000 max position size',
      'All trading strategies',
      'Priority email support',
      'Advanced analytics',
    ],
    popular: true,
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: 1999,
    description: 'Maximum performance',
    features: [
      'Unlimited open positions',
      '$5,000 max position size',
      'All trading strategies',
      '24/7 priority support',
      'Advanced analytics',
      'Custom strategy configuration',
      'Dedicated account manager',
    ],
  },
];

export default function Subscribe() {
  const [selectedTier, setSelectedTier] = useState<'basic' | 'pro' | 'enterprise' | null>(null);
  const { toast } = useToast();
  
  const createCheckout = trpc.subscription.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        toast({
          title: "Redirecting to checkout...",
          description: "Opening Stripe payment page",
        });
        window.open(data.checkoutUrl, '_blank');
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubscribe = (tier: 'basic' | 'pro' | 'enterprise') => {
    setSelectedTier(tier);
    createCheckout.mutate({ tier });
  };

  return (
    <div className="w-full py-6">
      <div className="w-full px-4">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">
            Choose Your Trading Plan
          </h2>
          <p className="text-sm text-muted-foreground">
            Start trading on Polymarket with our automated bot
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {TIERS.map((tier) => (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${
                tier.popular ? 'ring-2 ring-primary' : ''
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-medium">
                  Most Popular
                </div>
              )}
              
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription className="text-xs">
                  {tier.description}
                </CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">${tier.price}</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1 py-3">
                <ul className="space-y-1.5">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-3">
                <Button
                  className="w-full"
                  variant={tier.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={createCheckout.isPending && selectedTier === tier.id}
                >
                  {createCheckout.isPending && selectedTier === tier.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Subscribe Now'
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-4 text-center text-muted-foreground text-xs">
          <p>All plans include a secure Stripe payment gateway</p>
          <p className="mt-1">Cancel anytime • No hidden fees • 24/7 support</p>
        </div>
      </div>
    </div>
  );
}