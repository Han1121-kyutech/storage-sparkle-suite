import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ItemsPage from "@/pages/ItemsPage";
import RequestsPage from "@/pages/RequestsPage";
import AdminPage from "@/pages/AdminPage";
import NotFound from "./pages/NotFound.tsx";
import { useEffect } from 'react'
import { supabase } from './lib/supabase'

const queryClient = new QueryClient();


const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/" replace />;
  if (adminOnly && currentUser.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const LoginRoute = () => {
  const { currentUser } = useAuth();
  if (currentUser) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
};

const App = () => {
  
  useEffect(() => {
  console.log("🔥 useEffect動いた");

  const testInsert = async () => {
    console.log("🔥 insert開始");

    const { data, error } = await supabase
      .from('requests')
      .insert([
        {
          item_id: 1,
          user_id: '11111111-1111-1111-1111-111111111111',
          request_quantity: 2
        }
      ])

    console.log("🔥 data:", data)
    console.log("🔥 error:", error)
  }

  testInsert()
}, [])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<LoginRoute />} />
              <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App;
