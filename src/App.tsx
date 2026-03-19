import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";

// Lazy load pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const SimplifiedAdminDashboard = lazy(() => import("./pages/SimplifiedAdminDashboard"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const TestDropdown = lazy(() => import("./pages/TestDropdown"));
const Presentation = lazy(() => import("./pages/Presentation"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Auth Guard to protect private routes while keeping context providers global
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Chargement...</div>;
  }
  
  if (!session) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Chargement...</div>}>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/presentation" element={<Presentation />} />
            
            {/* Protected Routes */}
            <Route path="/" element={<AuthGuard><Index /></AuthGuard>} />
            <Route path="/admin" element={<AuthGuard><SimplifiedAdminDashboard /></AuthGuard>} />
            <Route path="/test-dropdown" element={<AuthGuard><TestDropdown /></AuthGuard>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
