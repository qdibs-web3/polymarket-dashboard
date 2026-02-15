import { Route, Switch } from "wouter";
import LoginPage from "./pages/Login";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
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