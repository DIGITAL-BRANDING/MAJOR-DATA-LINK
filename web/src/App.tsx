import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { SERVICES } from './lib/services';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BuyAirtimePage from './pages/BuyAirtimePage';
import BuyDataPage from './pages/BuyDataPage';
import ComingSoonPage from './pages/ComingSoonPage';
import PrivacyRedirect from './pages/PrivacyRedirect';
import ResultPinPage from './pages/ResultPinPage';
import VerificationPage from './pages/VerificationPage';
import FundWalletPage from './pages/FundWalletPage';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="h-8 w-8 rounded-full border-2 border-gold-500 border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/privacy-policy" element={<PrivacyRedirect page="privacy-policy" />} />
          <Route path="/waec-result" element={<ProtectedRoute><ResultPinPage exam="WAEC" /></ProtectedRoute>} />
          <Route path="/neco-result" element={<ProtectedRoute><ResultPinPage exam="NECO" /></ProtectedRoute>} />
          <Route path="/nin-services" element={<ProtectedRoute><VerificationPage mode="nin" /></ProtectedRoute>} />
          <Route path="/bvn-services" element={<ProtectedRoute><VerificationPage mode="bvn" /></ProtectedRoute>} />
          <Route path="/terms" element={<PrivacyRedirect page="terms" />} />
          <Route path="/fund-wallet" element={<ProtectedRoute><FundWalletPage /></ProtectedRoute>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/buy-airtime"
            element={
              <ProtectedRoute>
                <BuyAirtimePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/buy-data"
            element={
              <ProtectedRoute>
                <BuyDataPage />
              </ProtectedRoute>
            }
          />
          {/* Every service in the catalog that isn't built on the web yet
              gets a friendly "coming soon" page instead of a dead link —
              generated straight from lib/services.ts so a new service only
              ever needs to be added in one place. */}
          {SERVICES.filter((s) => !s.implemented).map((service) => (
            <Route
              key={service.route}
              path={service.route}
              element={
                <ProtectedRoute>
                  <ComingSoonPage service={service} />
                </ProtectedRoute>
              }
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
