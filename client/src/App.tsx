import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import Positions from "./pages/Positions";
import BotControl from "./pages/BotControl";
import Configuration from "./pages/Configuration";
import Markets from "./pages/Markets";
import LoginPage from "./pages/Login";
import SignUpPage from "./pages/SignUp";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/signup"} component={SignUpPage} />
      <Route path={"/"} component={Dashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/trades"} component={Trades} />
      <Route path={"/positions"} component={Positions} />
      <Route path={"/control"} component={BotControl} />
      <Route path={"/config"} component={Configuration} />
      <Route path={"/markets"} component={Markets} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
