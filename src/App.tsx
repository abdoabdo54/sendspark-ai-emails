
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useOrganizations } from "@/hooks/useOrganizations";
import AuthForm from "@/components/AuthForm";
import OrganizationSetup from "@/components/OrganizationSetup";
import SuperAdminSetup from "@/components/SuperAdminSetup";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading: authLoading } = useAuth();
  const { organizations, currentOrganization, loading: orgLoading } = useOrganizations();
  const [showSuperAdminSetup, setShowSuperAdminSetup] = useState(false);

  // Check if this is the first time setup (no organizations exist and user is authenticated)
  useEffect(() => {
    if (user && !orgLoading && organizations.length === 0) {
      // Check if this should be super admin setup
      // You can customize this logic based on your needs (e.g., check email domain, etc.)
      const isSuperAdminEmail = user.email?.includes('admin') || 
                               user.email?.includes('support') || 
                               organizations.length === 0; // For demo purposes, first user becomes super admin
      
      if (isSuperAdminEmail) {
        setShowSuperAdminSetup(true);
      }
    }
  }, [user, organizations, orgLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Show super admin setup if needed
  if (showSuperAdminSetup) {
    return <SuperAdminSetup />;
  }

  if (organizations.length === 0) {
    return <OrganizationSetup />;
  }

  if (!currentOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No Organization Selected</h2>
          <p className="text-slate-600">Please select an organization to continue</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <AppContent />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
