import { useAccount } from "wagmi";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { AppSidebar } from "./AppSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isConnected } = useAccount();
  const [, setLocation] = useLocation();

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
    <div className="min-h-screen bg-[#0a0a0b] flex">
      {/* Sidebar — now its own component */}
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}