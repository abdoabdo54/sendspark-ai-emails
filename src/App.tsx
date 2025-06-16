
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SimpleOrganizationProvider } from "@/contexts/SimpleOrganizationContext";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SimpleOrganizationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
        </BrowserRouter>
      </TooltipProvider>
    </SimpleOrganizationProvider>
  </QueryClientProvider>
);

export default App;
