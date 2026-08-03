import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useEffect } from 'react';

import SalesPage from '@/pages/SalesPage';
import OrderPage from '@/pages/OrderPage';
import FoundingOfferPage from '@/pages/FoundingOfferPage';
import PublisherPage from '@/pages/PublisherPage';
import ThanksPage from '@/pages/ThanksPage';
import { TermsPage, PrivacyPage, RefundPage } from '@/pages/legal';
import SupportPage from '@/pages/SupportPage';
import ShelfPage from '@/pages/ShelfPage';
import ArticlesPage from '@/pages/ArticlesPage';
import ArticlePage from '@/pages/ArticlePage';

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={SalesPage} />
      <Route path="/order" component={OrderPage} />
      <Route path="/founding-offer" component={FoundingOfferPage} />
      <Route path="/publisher" component={PublisherPage} />
      <Route path="/thanks" component={ThanksPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/refund-policy" component={RefundPage} />
      <Route path="/support" component={SupportPage} />
      <Route path="/shelf" component={ShelfPage} />
      <Route path="/articles" component={ArticlesPage} />
      <Route path="/articles/:slug" component={ArticlePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <ScrollToTop />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
