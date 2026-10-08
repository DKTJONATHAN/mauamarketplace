import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const BrowsePage = lazy(() => import('./pages/BrowsePage').then((m) => ({ default: m.BrowsePage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const ConversationPage = lazy(() => import('./pages/ConversationPage').then((m) => ({ default: m.ConversationPage })));
const ConfirmEmailPage = lazy(() => import('./pages/ConfirmEmailPage').then((m) => ({ default: m.ConfirmEmailPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
import { HomePage } from './pages/HomePage';
const ListingPage = lazy(() => import('./pages/ListingPage').then((m) => ({ default: m.ListingPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const MyListingsPage = lazy(() => import('./pages/MyListingsPage').then((m) => ({ default: m.MyListingsPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const RulesPage = lazy(() => import('./pages/RulesPage').then((m) => ({ default: m.RulesPage })));
const SafetyPage = lazy(() => import('./pages/SafetyPage').then((m) => ({ default: m.SafetyPage })));
const SavedPage = lazy(() => import('./pages/SavedPage').then((m) => ({ default: m.SavedPage })));
const SellerDashboardPage = lazy(() => import('./pages/SellerDashboardPage').then((m) => ({ default: m.SellerDashboardPage })));
const SellPage = lazy(() => import('./pages/SellPage').then((m) => ({ default: m.SellPage })));
const SellerPage = lazy(() => import('./pages/SellerPage').then((m) => ({ default: m.SellerPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/TermsPage').then((m) => ({ default: m.TermsPage })));

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  // Remount / reset the boundary whenever the route changes so a one-off crash
  // does not trap the whole app until a full browser reload.
  return <ErrorBoundary resetKey={location.pathname + location.search}>{children}</ErrorBoundary>;
}

export function App() {
  return (
    <RouteErrorBoundary>
    <Suspense fallback={<div className="wrap page" aria-busy="true">Loading...</div>}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="browse" element={<BrowsePage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="listing/:id" element={<ListingPage />} />
        <Route path="seller/:id" element={<SellerPage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="signup" element={<AuthPage mode="signup" />} />
        <Route path="auth/confirm" element={<ConfirmEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="safety" element={<SafetyPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="sell" element={<SellPage />} />
          <Route path="sell/:id/edit" element={<SellPage />} />
          <Route path="my-listings" element={<MyListingsPage />} />
          <Route path="messages/:id" element={<ConversationPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="seller-dashboard" element={<SellerDashboardPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
    </RouteErrorBoundary>
  );
}
