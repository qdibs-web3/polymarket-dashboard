import { Route, Switch } from "wouter";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import Positions from "./pages/Positions";
import BotControl from "./pages/BotControl";
import Markets from "./pages/Markets";
import Configuration from "./pages/Configuration";
import Admin from "./pages/Admin";
import PaymentHistory from "./pages/PaymentHistory";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={LoginPage} />
      
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
      
      <Route path="/control">
        <DashboardLayout>
          <BotControl />
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
      
      <Route path="/admin">
        <DashboardLayout>
          <Admin />
        </DashboardLayout>
      </Route>
      
      <Route path="/payment-history">
        <DashboardLayout>
          <PaymentHistory />
        </DashboardLayout>
      </Route>
      
      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default App;