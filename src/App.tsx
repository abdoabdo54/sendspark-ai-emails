
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SimpleOrganizationProvider } from "@/contexts/SimpleOrganizationContext";
import Index from "./pages/Index";
import { useState } from "react";

const queryClient = new QueryClient();

const App = () => {
  const [activeTab, setActiveTab] = useState("bulk");

  return (
    <QueryClientProvider client={queryClient}>
      <SimpleOrganizationProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route 
                path="/" 
                element={<Index activeTab={activeTab} onTabChange={setActiveTab} />} 
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SimpleOrganizationProvider>
    </QueryClientProvider>
  );
};

export default App;
