import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Warehouse,
  LayoutDashboard,
  Package,
  ClipboardList,
  Shield,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  // スマホ用メニューの開閉状態を管理するフラグ
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { to: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
    { to: "/items", label: "物品一覧", icon: Package },
    { to: "/requests", label: "申請一覧", icon: ClipboardList },
  ];

  if (currentUser?.role === "admin") {
    navItems.push({ to: "/admin", label: "管理", icon: Shield });
  }

  // メニューのリンクを押した時に、スマホならメニューを閉じる処理
  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* 📱 スマホ用のトップヘッダー（PCでは md:hidden で非表示になる） */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-40">
        <div className="flex items-center gap-2">
          <Warehouse className="h-6 w-6 text-primary" />
          <h1 className="font-mono text-base font-bold text-primary">
            倉庫管理
          </h1>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-foreground"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* 📱 スマホでメニューが開いている時の黒い半透明背景（画面外タップで閉じる用） */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* 💻 サイドバー（PCでは常に表示、スマホではスライドして出てくる） */}
      <aside
        className={`
          w-64 bg-card border-r border-border flex flex-col
          /* PC用（md以上）の設定：相対配置にして常に表示 */
          md:relative md:translate-x-0
          /* スマホ用の設定：絶対配置にして画面外に隠し、isMobileMenuOpenがtrueの時だけスライドイン */
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-in-out
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Warehouse className="h-7 w-7 text-primary" />
            <h1 className="font-mono text-lg font-bold text-primary">
              倉庫管理
            </h1>
          </div>
          {/* サイドバー内のスマホ用閉じるボタン（PCでは非表示） */}
          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
              <p className="text-sm font-medium text-foreground">
                {currentUser?.user_name}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {currentUser?.role === "admin" ? "管理者" : "一般"}
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

      {/* 📦 メインコンテンツ部分 */}
      {/* スマホの時はトップヘッダー（h-16=pt-16）の分だけ中身を下にずらす。PCの時はゼロ（md:pt-0） */}
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        {/* スマホの時は余白を小さく（p-4）、PCの時は大きく（md:p-8）して圧迫感をなくす */}
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppLayout;
