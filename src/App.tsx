import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import SalesPage from '@/pages/SalesPage';
import OrderPage from '@/pages/OrderPage';
import ThanksPage from '@/pages/ThanksPage';
import { TermsPage, PrivacyPage, RefundPage } from '@/pages/legal';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={SalesPage} />
      <Route path="/order" component={OrderPage} />
      <Route path="/thanks" component={ThanksPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund-policy" component={RefundPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
