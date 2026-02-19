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
  Home,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  User,
  Activity,
} from "lucide-react";
import { useEffect } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Trades", href: "/trades", icon: TrendingUp },
  { name: "Positions", href: "/positions", icon: BarChart3 },
  { name: "Markets", href: "/markets", icon: Activity },
  { name: "Configuration", href: "/config", icon: Settings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [location, setLocation] = useLocation();

  // Redirect to login if not connected
  useEffect(() => {
    if (!isConnected) {
      setLocation("/login");
    }
  }, [isConnected, setLocation]);

  const handleLogout = () => {
    disconnect();
    setLocation("/login");
  };

  if (!isConnected) {
    return null; // Will redirect
  }

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[#27272a]">
          <h1 className="text-xl font-bold text-white">Polymarket Bot</h1>
          <p className="text-sm text-gray-400 mt-1">Trading Dashboard</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || location === item.href.replace("/dashboard", "/");
            
            return (
              <button
                key={item.name}
                onClick={() => setLocation(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-gray-400 hover:bg-[#27272a] hover:text-white"
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
                className="w-full justify-start gap-3 text-gray-400 hover:text-white hover:bg-[#27272a]"
              >
                <User className="h-5 w-5" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium">{shortAddress}</p>
                  <p className="text-xs text-gray-500">Connected</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#18181b] border-[#27272a]">
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

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
