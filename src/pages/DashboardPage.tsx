import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Item, Request } from "@/types";
import {
  Package,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [itemRes, reqRes] = await Promise.all([
          supabase.from("items").select("*"),
          supabase.from("requests").select("*"),
        ]);

        if (itemRes.error) throw itemRes.error;
        if (reqRes.error) throw reqRes.error;

        setItems(itemRes.data || []);
        setRequests(reqRes.data || []);
      } catch (error: any) {
        toast.error("データの同期に失敗しました: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const role = currentUser?.role ?? 0;
  const isAdmin = role >= 1;

  const targetRequests = isAdmin
    ? requests
    : requests.filter((r) => String(r.user_id) === String(currentUser?.id));

  // ★ハードコードを排除し、各アイテムの個別閾値（未設定時は5）を基準に判定する
  const lowStockItems = items.filter(
    (i) => i.stock_quantity < (i.alert_threshold ?? 5),
  );

  const pendingRequests = targetRequests.filter((r) => r.status === "pending");
  const approvedRequests = targetRequests.filter(
    (r) => r.status === "approved",
  );

  const stats = [
    {
      label: "登録物品数",
      value: items.length,
      icon: Package,
      color: "text-info",
      path: "/items",
    },
    {
      label: isAdmin ? "全体の未承認申請" : "あなたの未承認申請",
      value: pendingRequests.length,
      icon: ClipboardList,
      color: "text-primary",
      path: isAdmin ? "/admin" : "/requests",
    },
    {
      label: "在庫少アラート",
      value: lowStockItems.length,
      icon: AlertTriangle,
      color: "text-destructive",
      path: isAdmin ? "/admin" : "/items",
    },
    {
      label: isAdmin ? "全体の承認済み" : "あなたの承認済み",
      value: approvedRequests.length,
      icon: CheckCircle,
      color: "text-success",
      path: isAdmin ? "/admin" : "/requests",
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh] text-primary">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
          ダッシュボード
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          ようこそ、{currentUser?.user_name}さん
          <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold bg-secondary text-secondary-foreground border border-border">
            {role === 2 ? "最高管理者" : role === 1 ? "管理者" : "一般ユーザー"}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            onClick={() => navigate(s.path)}
            className="p-5 rounded-lg bg-card border border-border shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 group relative"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                {s.label}
              </p>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-3xl font-black font-mono mt-2 text-foreground group-hover:text-primary transition-colors">
              {s.value}
            </p>
            <ChevronRight className="h-4 w-4 absolute bottom-4 right-4 opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
        ))}
      </div>

      {lowStockItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive animate-pulse" />
              在庫が少ない物品
            </h3>
            <button
              onClick={() => navigate(isAdmin ? "/admin" : "/items")}
              className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              詳細を見る <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold">
                  <tr>
                    <th className="px-4 py-3 w-16">ID</th>
                    <th className="px-4 py-3">物品名 / ラベル</th>
                    <th className="px-4 py-3">保管場所</th>
                    <th className="px-4 py-3 text-right">在庫数 / 閾値</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {lowStockItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(isAdmin ? "/admin" : "/items")}
                      className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 font-mono text-[10px] opacity-50">
                        #{item.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {item.category && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                              {item.category}
                            </span>
                          )}
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {item.item_name}
                          </span>
                        </div>
                        <div className="text-[10px] mt-1 flex items-center gap-2">
                          {item.label_no && (
                            <span className="bg-secondary px-1.5 py-0.5 rounded font-mono border border-border/50 text-muted-foreground">
                              {item.label_no}
                            </span>
                          )}
                          <span className="italic text-muted-foreground">
                            {item.specifications || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-1 opacity-80">
                          <MapPin className="h-3 w-3" /> {item.location_name}
                        </div>
                        <div className="font-mono text-[10px] bg-secondary/50 inline-block px-1 rounded mt-1 opacity-70">
                          #{item.location_no}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-lg text-destructive font-black">
                          {item.stock_quantity}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          / {item.alert_threshold ?? 5}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
