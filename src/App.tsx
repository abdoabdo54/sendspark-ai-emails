
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SimpleOrganizationProvider } from "@/contexts/SimpleOrganizationContext";
import AuthForm from "./components/AuthForm";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import SendEmail from "./pages/SendEmail";
import Campaigns from "./pages/Campaigns";
import FunctionManager from "./pages/FunctionManager";
import SmartConfig from "./pages/SmartConfig";
import PowerMTAServers from "./pages/PowerMTAServers";
import Tools from "./pages/Tools";
import Header from "./components/Header";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <SimpleOrganizationProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/send-email" element={<SendEmail />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/function-manager" element={<FunctionManager />} />
          <Route path="/smart-config" element={<SmartConfig />} />
          <Route path="/powermta-servers" element={<PowerMTAServers />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </SimpleOrganizationProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
