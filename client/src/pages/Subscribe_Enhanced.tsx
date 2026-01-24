import { useState } from "react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Loader2, Zap, TrendingUp, Shield, Clock, BarChart3, Users } from "lucide-react";
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

const BENEFITS = [
  {
    icon: Zap,
    title: "24/7 Automated Trading",
    description: "Never miss a profitable opportunity, even while you sleep"
  },
  {
    icon: TrendingUp,
    title: "Proven Strategies",
    description: "Leverage algorithms with a track record of consistent returns"
  },
  {
    icon: Shield,
    title: "Risk Management",
    description: "Built-in safeguards to protect your capital"
  },
  {
    icon: Clock,
    title: "Save Time",
    description: "Stop monitoring markets manually—let the bot do the work"
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description: "Track performance with detailed metrics and insights"
  },
  {
    icon: Users,
    title: "Join 500+ Traders",
    description: "Be part of a growing community of successful bot traders"
  }
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full py-6">
      <div className="w-full px-4">
        {/* Hero Section */}
        <motion.div 
          className="text-center mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400">
            Choose Your Trading Plan
          </h2>
          <p className="text-lg text-muted-foreground mb-2">
            Start trading on Polymarket with our automated bot
          </p>
          <p className="text-sm text-muted-foreground">
            Join hundreds of traders who are already profiting 24/7
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div 
          className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {BENEFITS.map((benefit, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <benefit.icon className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold">{benefit.title}</h4>
                <p className="text-xs text-muted-foreground">{benefit.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Pricing Cards */}
        <motion.div 
          className="grid grid-cols-3 gap-4 mb-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {TIERS.map((tier, index) => (
            <motion.div
              key={tier.id}
              variants={itemVariants}
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Card
                className={`relative flex flex-col h-full ${
                  tier.popular ? 'ring-2 ring-primary shadow-lg' : ''
                }`}
              >
                {tier.popular && (
                  <motion.div 
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-0.5 rounded-full text-xs font-medium"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                  >
                    Most Popular
                  </motion.div>
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
                    {tier.features.map((feature, featureIndex) => (
                      <motion.li 
                        key={featureIndex} 
                        className="flex items-start gap-2 text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * featureIndex }}
                      >
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-3">
                  <Button
                    className={`w-full ${tier.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
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
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Badges */}
        <motion.div 
          className="text-center text-muted-foreground text-xs space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-500" />
              <span>Secure Stripe Payment</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              <span>30-Day Money-Back Guarantee</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span>Cancel Anytime</span>
            </div>
          </div>
          <p className="text-xs">No hidden fees • 24/7 support • Instant activation</p>
        </motion.div>
      </div>
    </div>
  );
}