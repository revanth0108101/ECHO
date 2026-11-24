import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import Home from "./pages/Home";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/memories" component={Home} />
      <Route path="/graph" component={Home} />
      <Route path="/recall" component={Home} />
      <Route path="/assistant" component={Home} />
      <Route path="/gaps" component={Home} />
      <Route path="/timeline" component={Home} />
      <Route path="/collections" component={Home} />
      <Route path="/settings" component={Home} />
      <Route path="/profile" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemedApplication() {
  const { theme } = useTheme();
  return <>
    <Toaster richColors theme={theme} />
    <Router />
  </>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <ThemedApplication />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
