import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Calendar, List, Settings, MessageSquare, CheckCircle2, XCircle, Sun, Moon, LogOut, Menu } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/CalendarPage";
import EventsPage from "./pages/EventsPage";
import SettingsPage from "./pages/SettingsPage";
import AuthPage from "./pages/AuthPage";
import { supabase } from "./lib/supabaseClient";
import { motion, AnimatePresence } from "motion/react";

const NavItem = ({ to, icon: Icon, label, onClick }: { to: string, icon: any, label: string, onClick?: () => void }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      id={`nav-${label.toLowerCase()}`}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive 
          ? "bg-blue-600 text-white" 
          : "text-gray-400 hover:bg-gray-800 hover:text-white"
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
      {isActive && (
        <motion.div
          layoutId="nav-active-pill"
          className="absolute left-0 w-1 h-6 bg-blue-400 rounded-r-full"
        />
      )}
    </Link>
  );
};

const MobileNav = () => {
  const location = useLocation();

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/calendar", icon: Calendar, label: "Calendário" },
    { to: "/events", icon: List, label: "Eventos" },
    { to: "/settings", icon: Settings, label: "Configurações" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 flex justify-around p-2 md:hidden z-30">
      {navItems.map((item) => {
        const isActive = location.pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
              isActive ? "text-blue-600" : "text-gray-400"
            }`}
          >
            <item.icon size={20} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.user_metadata?.theme) {
      setTheme(session.user.user_metadata.theme);
    }
  }, [session]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    // Persist to user metadata if logged in
    if (session) {
      supabase.auth.updateUser({ data: { theme } });
    }
  }, [theme]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  useEffect(() => {
    if (!loading && !session && location.pathname !== '/auth') {
      navigate('/auth');
    }
  }, [loading, session, location.pathname, navigate]);

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;

  const currentPath = location.pathname.split("/")[1] || "Dashboard";

  return (
    <div className="flex min-h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 font-sans pb-16 md:pb-0">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-10 md:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-20 w-64 border-r border-gray-200 dark:border-gray-800 flex-col p-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl transition-transform duration-300 ease-in-out
        md:static md:translate-x-0 hidden md:flex
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-3 px-4 mb-10 mt-2">
          <div className="p-2 bg-blue-600 rounded-lg">
            <Calendar className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">WhatsApp Sync</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="ml-auto md:hidden p-2 text-gray-500">
            <XCircle size={24} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 relative">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/calendar" icon={Calendar} label="Calendário" onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/events" icon={List} label="Eventos" onClick={() => setIsSidebarOpen(false)} />
          <NavItem to="/settings" icon={Settings} label="Configurações" onClick={() => setIsSidebarOpen(false)} />
        </nav>

        <div className="mt-auto p-4 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">WhatsApp Status</span>
            <StatusIndicator />
          </div>
          <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-full" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 md:px-8 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">Páginas /</span>
              <span className="font-medium text-gray-900 dark:text-white capitalize truncate">
                {currentPath}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
               onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
               className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600" />
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/auth" element={<AuthPage />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}

function StatusIndicator() {
  // This would ideally poll the API
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
      <span className="text-[10px] uppercase font-bold text-green-500 tracking-wider">Online</span>
    </div>
  );
}
