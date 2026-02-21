import { Badge } from "@/components/ui/badge";
import { Crown, Star, Zap } from "lucide-react";

interface SubscriptionBadgeProps {
  tier: number;
  expiresAt: Date;
  className?: string;
}

const TIER_CONFIG = {
  1: {
    name: "Basic",
    icon: Zap,
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  2: {
    name: "Pro",
    icon: Star,
    className: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
  3: {
    name: "Premium",
    icon: Crown,
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
};

export function SubscriptionBadge({ tier, expiresAt, className }: SubscriptionBadgeProps) {
  const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <Badge className={`${config.className} ${className || ""}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.name}
    </Badge>
  );
}