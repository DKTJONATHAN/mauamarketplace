import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
const AccountPage = lazy(() => import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const BrowsePage = lazy(() => import('./pages/BrowsePage').then((m) => ({ default: m.BrowsePage })));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const ConversationPage = lazy(() => import('./pages/ConversationPage').then((m) => ({ default: m.ConversationPage })));
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
const SellPage = lazy(() => import('./pages/SellPage').then((m) => ({ default: m.SellPage })));
const SellerPage = lazy(() => import('./pages/SellerPage').then((m) => ({ default: m.SellerPage })));

export function App() {
  return (
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
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="safety" element={<SafetyPage />} />
        <Route path="rules" element={<RulesPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="sell" element={<SellPage />} />
          <Route path="sell/:id/edit" element={<SellPage />} />
          <Route path="my-listings" element={<MyListingsPage />} />
          <Route path="messages/:id" element={<ConversationPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
