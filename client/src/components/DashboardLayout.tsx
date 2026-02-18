import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, History, TrendingUp, Settings, Play, BarChart3 } from "lucide-react";
import { CSSProperties, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAccount, useDisconnect } from "wagmi";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: History, label: "Trades", path: "/trades" },
  { icon: TrendingUp, label: "Positions", path: "/positions" },
  { icon: Play, label: "Bot Control", path: "/control" },
  { icon: BarChart3, label: "Markets", path: "/markets" },
  { icon: Settings, label: "Configuration", path: "/config" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { address, isConnected } = useAccount();
  const [, setLocation] = useLocation();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Redirect to login if not connected
  useEffect(() => {
    if (!isConnected) {
      setLocation("/login");
    }
  }, [isConnected, setLocation]);

  if (!isConnected) {
    return null; // Will redirect
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} address={address}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  address: string | undefined;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  address,
}: DashboardLayoutContentProps) {
  const [location, setLocation] = useLocation();
  const { disconnect } = useDisconnect();
  const isMobile = useIsMobile();
  const { open } = useSidebar();

  const handleLogout = () => {
    disconnect();
    setLocation("/login");
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </div>
            {open && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Polymarket Bot</span>
                <span className="text-xs text-muted-foreground">Trading Dashboard</span>
              </div>
            )}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  onClick={() => setLocation(item.path)}
                  isActive={location === item.path}
                  tooltip={item.label}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {address?.slice(2, 4).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {open && (
                      <div className="flex flex-col items-start text-left">
                        <span className="text-xs font-medium">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </span>
                        <span className="text-xs text-muted-foreground">Connected</span>
                      </div>
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Disconnect</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="flex flex-1 items-center justify-between">
            <h2 className="text-lg font-semibold">
              {menuItems.find((item) => item.path === location)?.label || "Dashboard"}
            </h2>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}