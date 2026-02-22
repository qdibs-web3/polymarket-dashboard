import { useAccount, useDisconnect } from "wagmi";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Home,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  User,
  Lock,
  FileText,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiresSubscription: boolean;
}

const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home, requiresSubscription: false },
  { name: "Trades", href: "/trades", icon: TrendingUp, requiresSubscription: true },
  { name: "Positions", href: "/positions", icon: BarChart3, requiresSubscription: true },
  { name: "Configuration", href: "/config", icon: Settings, requiresSubscription: true },
];

export function AppSidebar() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const [location, setLocation] = useLocation();

  const { data: subscription } = trpc.subscription.getStatus.useQuery(
    { walletAddress: address! },
    { enabled: !!address }
  );

  const isSubscribed = subscription?.isActive ?? false;

  const handleLogout = () => {
    disconnect();
    setLocation("/login");
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <aside className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-[#27272a]">
        <h1 className="text-xl font-bold text-white drop-shadow-[0_0_12px_rgba(59,130,246,0.9)]">
          Predictive Apex
        </h1>
        <p className="text-sm text-gray-400 mt-1">Trading Dashboard</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive =
            location === item.href ||
            (item.href === "/dashboard" && location === "/");
          const isLocked = item.requiresSubscription && !isSubscribed;

          if (isLocked) {
            return (
              <Tooltip key={item.name} delayDuration={200}>
                <TooltipTrigger asChild>
                  <button
                    disabled
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 cursor-not-allowed opacity-50 transition-all duration-200"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium flex-1 text-left">{item.name}</span>
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-[#27272a] border-[#3f3f46] text-gray-200">
                  Subscribe to unlock {item.name}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <button
              key={item.name}
              onClick={() => setLocation(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? "bg-blue-500/10 text-blue-400 shadow-[0_0_14px_3px_rgba(255,255,255,0.08)]"
                  : "text-gray-400 hover:bg-[#27272a] hover:text-white hover:shadow-[0_0_14px_3px_rgba(255,255,255,0.10)]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="font-medium">{item.name}</span>
            </button>
          );
        })}
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t border-[#27272a]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-gray-400 hover:text-white hover:bg-[#27272a] hover:shadow-[0_0_14px_3px_rgba(255,255,255,0.10)] transition-all duration-200"
            >
              <User className="h-5 w-5" />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium">{shortAddress}</p>
                <p className="text-xs text-gray-500">Connected</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-[#18181b] border-[#27272a]"
          >
            <DropdownMenuLabel className="text-gray-400">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-[#27272a]" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect Wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}