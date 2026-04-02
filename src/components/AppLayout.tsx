import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Warehouse, LayoutDashboard, Package, ClipboardList, Shield, LogOut } from 'lucide-react';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { to: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
    { to: '/items', label: '物品一覧', icon: Package },
    { to: '/requests', label: '申請一覧', icon: ClipboardList },
  ];

  if (currentUser?.role === 'admin') {
    navItems.push({ to: '/admin', label: '管理', icon: Shield });
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-5 border-b border-border flex items-center gap-3">
          <Warehouse className="h-7 w-7 text-primary" />
          <h1 className="font-mono text-lg font-bold text-primary">倉庫管理</h1>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{currentUser?.user_name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {currentUser?.role === 'admin' ? '管理者' : '一般'}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
