import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Subscribe from "./pages/Subscribe";
import Trades from "./pages/Trades";
import Positions from "./pages/Positions";
import Configuration from "./pages/Configuration";
import DashboardLayout from "./components/DashboardLayout";
import { SubscriptionGuard } from "./components/SubscriptionGuard";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />

      {/* Subscription page (for non-subscribers) */}
      <Route path="/subscribe" component={Subscribe} />

      {/* Dashboard — accessible to all connected wallets */}
      <Route path="/">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>

      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>

      {/* Subscription-gated routes */}
      <Route path="/trades">
        <DashboardLayout>
          <SubscriptionGuard>
            <Trades />
          </SubscriptionGuard>
        </DashboardLayout>
      </Route>

      <Route path="/positions">
        <DashboardLayout>
          <SubscriptionGuard>
            <Positions />
          </SubscriptionGuard>
        </DashboardLayout>
      </Route>

      <Route path="/config">
        <DashboardLayout>
          <SubscriptionGuard>
            <Configuration />
          </SubscriptionGuard>
        </DashboardLayout>
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;