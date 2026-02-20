import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Subscribe from "./pages/Subscribe";
import Trades from "./pages/Trades";
import Positions from "./pages/Positions";
import Markets from "./pages/Markets";
import Configuration from "./pages/Configuration";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Logs from "./pages/Logs";
import "./index.css";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      
      {/* Subscription page (for non-subscribers) */}
      <Route path="/subscribe" component={Subscribe} />
      
      {/* Protected routes with DashboardLayout */}
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
      
      <Route path="/trades">
        <DashboardLayout>
          <Trades />
        </DashboardLayout>
      </Route>
      
      <Route path="/positions">
        <DashboardLayout>
          <Positions />
        </DashboardLayout>
      </Route>

      <Route path="/positions">
        <DashboardLayout>
          <Logs />
        </DashboardLayout>
      </Route>
      
      <Route path="/markets">
        <DashboardLayout>
          <Markets />
        </DashboardLayout>
      </Route>
      
      <Route path="/config">
        <DashboardLayout>
          <Configuration />
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
