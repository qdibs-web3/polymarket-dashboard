import { Route, Switch, useLocation } from "wouter";
import { useAuth } from "./contexts/AuthContext";
import { useEffect } from "react";
import LoginPage from "./pages/Login";
import VerifyMagicLink from "./pages/VerifyMagicLink";
import GoogleCallback from "./pages/GoogleCallback";
import Dashboard from "./pages/Dashboard";
import Configuration from "./pages/Configuration";
import Trades from "./pages/Trades";
import Positions from "./pages/Positions";
import BotControl from "./pages/BotControl";
import Markets from "./pages/Markets";
import DashboardLayout from "./components/DashboardLayout";

function ProtectedRoute({ component: Component, ...rest }: any) {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <Component {...rest} /> : null;
}

function App() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/auth/verify" component={VerifyMagicLink} />
      <Route path="/auth/callback" component={GoogleCallback} />
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/config">
        <ProtectedRoute component={Configuration} />
      </Route>
      <Route path="/trades">
        <ProtectedRoute component={Trades} />
      </Route>
      <Route path="/positions">
        <ProtectedRoute component={Positions} />
      </Route>
      <Route path="/control">
        <ProtectedRoute component={BotControl} />
      </Route>
      <Route path="/markets">
        <ProtectedRoute component={Markets} />
      </Route>
      <Route>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-gray-600">Page not found</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

export default App;