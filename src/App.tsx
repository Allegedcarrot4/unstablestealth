import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SettingsProvider } from "./contexts/SettingsContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { MainLayout } from "./layouts/MainLayout";
import { Embedder } from "./pages/Embedder";
import { Chat } from "./pages/Chat";
import { AI } from "./pages/AI";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Admin } from "./pages/Admin";
import { Agent } from "./pages/Agent";
import Games from "./pages/Games";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn, isLoading, isBanned, siteDisabled, isOwner } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-mono">Loading...</div>
      </div>
    );
  }
  
  if (!isLoggedIn || isBanned) {
    return <Navigate to="/login" replace />;
  }

  // Site is disabled and user is not an owner
  if (siteDisabled && !isOwner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="text-destructive text-6xl">⚠</div>
        <h1 className="text-2xl font-bold font-mono text-foreground">Site Disabled</h1>
        <p className="text-muted-foreground">The site has been temporarily disabled by the owner.</p>
        <p className="text-muted-foreground text-sm">Please check back later.</p>
      </div>
    );
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-mono">Loading...</div>
      </div>
    );
  }
  
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const OwnerRoute = ({ children }: { children: React.ReactNode }) => {
  const { isOwner, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-mono">Loading...</div>
      </div>
    );
  }
  
  if (!isOwner) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const LoginRoute = () => {
  const { isLoggedIn, isLoading, isBanned } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-mono">Loading...</div>
      </div>
    );
  }
  
  if (isLoggedIn && !isBanned) {
    return <Navigate to="/" replace />;
  }
  
  return <Login />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SettingsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route path="/" element={<Embedder />} />
                <Route path="/embedder" element={<Embedder />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/ai" element={<AI />} />
                <Route path="/games" element={<Games />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/admin" element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                } />
                <Route path="/agent" element={
                  <OwnerRoute>
                    <Agent />
                  </OwnerRoute>
                } />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
