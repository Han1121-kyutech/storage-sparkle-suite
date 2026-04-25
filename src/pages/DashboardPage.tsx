import { useState, useEffect, useMemo } from "react";
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
  ChevronLeft,
  Search,
  MapPin,
  Clock,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [lowStockSearch, setLowStockSearch] = useState("");
  const [lowStockPage, setLowStockPage] = useState(1);
  const LOW_STOCK_PAGE_SIZE = 10;

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [itemRes, reqRes, userRes] = await Promise.all([
          supabase.from("items").select("*"),
          supabase.from("requests").select("*"),
          supabase.from("users").select("*"), // ユーザー情報も取得（誰が延滞しているか表示するため）
        ]);

        if (itemRes.error) throw itemRes.error;
        if (reqRes.error) throw reqRes.error;
        if (userRes.error) throw userRes.error;

        setItems(itemRes.data || []);
        setRequests(reqRes.data || []);
        setUsers(userRes.data || []);
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

  const lowStockItems = items.filter(
    (i) =>
      (i.alert_threshold ?? 5) > 0 &&
      i.stock_quantity <= (i.alert_threshold ?? 5),
  );

  const filteredLowStockItems = useMemo(() => {
    const q = lowStockSearch.toLowerCase();
    if (!q) return lowStockItems;
    return lowStockItems.filter(
      (i) =>
        i.item_name.toLowerCase().includes(q) ||
        i.location_name.toLowerCase().includes(q) ||
        (i.label_no && i.label_no.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q)),
    );
  }, [lowStockItems, lowStockSearch]);

  const lowStockTotalPages = Math.max(
    1,
    Math.ceil(filteredLowStockItems.length / LOW_STOCK_PAGE_SIZE),
  );
  const pagedLowStockItems = filteredLowStockItems.slice(
    (lowStockPage - 1) * LOW_STOCK_PAGE_SIZE,
    lowStockPage * LOW_STOCK_PAGE_SIZE,
  );

  const pendingRequests = targetRequests.filter((r) => r.status === "pending");
  const approvedRequests = targetRequests.filter(
    (r) => r.status === "approved",
  );

  // ★ 備考(memo)から返却日を抽出し、延滞しているリクエストを割り出すハック
  const overdueRequests = useMemo(() => {
    // ローカルタイムで本日の午前0時を取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return approvedRequests.filter((req) => {
      // 貸出以外は無視
      if (req.request_type !== "checkout") return false;
      if (!req.memo) return false;

      // 正規表現で「返却:YYYY/MM/DD」を抽出
      const match = req.memo.match(/返却:(\d{4}\/\d{2}\/\d{2})/);
      if (!match) return false;

      const returnDate = new Date(match[1]);
      returnDate.setHours(0, 0, 0, 0);

      // 返却予定日が今日より前なら延滞（True）
      return returnDate < today;
    });
  }, [approvedRequests]);

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

      {/* ★ 返却期限切れアラートパネル ★ */}
      {overdueRequests.length > 0 && (
        <div className="bg-destructive/10 border-l-4 border-destructive rounded-r-xl p-4 sm:p-5 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start gap-3">
            <div className="bg-destructive text-white p-2 rounded-lg shrink-0 animate-pulse">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-destructive flex items-center gap-2 uppercase tracking-widest text-sm">
                Overdue Items
                <span className="bg-destructive text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                  {overdueRequests.length}件の延滞
                </span>
              </h3>
              <p className="text-xs text-destructive/80 mt-0.5 mb-3 font-bold">
                {isAdmin
                  ? "返却予定日を過ぎている貸出があります。利用者に催促してください。"
                  : "返却予定日を過ぎている物品があります。至急返却してください。"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {overdueRequests.map((req) => {
                  const item = items.find((i) => i.id === req.item_id);
                  const user = users.find(
                    (u) => String(u.id) === String(req.user_id),
                  );
                  const match = req.memo?.match(/返却:(\d{4}\/\d{2}\/\d{2})/);
                  const returnDateStr = match ? match[1] : "不明";

                  return (
                    <div
                      key={req.id}
                      onClick={() => navigate(isAdmin ? "/admin" : "/requests")}
                      className="bg-card border border-destructive/30 rounded-xl p-3 flex flex-col shadow-sm hover:border-destructive transition-colors gap-2 cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2 flex-1">
                          <div className="text-sm font-black text-foreground truncate">
                            {item?.item_name || "不明な物品"}
                          </div>

                          <div className="text-[10px] text-destructive font-black flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" /> 期限:{" "}
                            {returnDateStr}
                          </div>

                          {isAdmin && (
                            <div className="text-[10px] font-bold text-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border/50 inline-flex items-center gap-1 mt-2">
                              <UserIcon className="h-3 w-3 text-destructive" />{" "}
                              {user?.user_name || "退会ユーザー"}
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end pl-3 border-l border-border/30">
                          <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">
                            Qty
                          </span>
                          <span className="font-mono font-black text-xl leading-none text-foreground">
                            {req.request_quantity}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

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
              <span className="text-xs font-mono bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                {filteredLowStockItems.length}件
              </span>
            </h3>
            <button
              onClick={() => navigate(isAdmin ? "/admin" : "/items")}
              className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              詳細を見る <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* 検索窓 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="物品名・保管場所・ラベル・カテゴリで絞り込み..."
              value={lowStockSearch}
              onChange={(e) => {
                setLowStockSearch(e.target.value);
                setLowStockPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:ring-1 ring-primary shadow-sm"
            />
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
                  {pagedLowStockItems.length > 0 ? (
                    pagedLowStockItems.map((item) => (
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
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-sm text-muted-foreground"
                      >
                        該当する物品が見つかりません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {lowStockTotalPages > 1 &&
              (() => {
                // 現在ページを中心に最大5ページ分のウィンドウを計算
                const WINDOW = 5;
                let start = Math.max(1, lowStockPage - Math.floor(WINDOW / 2));
                let end = start + WINDOW - 1;
                if (end > lowStockTotalPages) {
                  end = lowStockTotalPages;
                  start = Math.max(1, end - WINDOW + 1);
                }
                const pageWindow = Array.from(
                  { length: end - start + 1 },
                  (_, i) => start + i,
                );

                return (
                  <div className="relative flex items-center justify-between gap-3 px-5 py-4 border-t border-border/50 bg-secondary/10">
                    {/* 件数表示（左） */}
                    <span className="text-xs text-muted-foreground font-mono">
                      {(lowStockPage - 1) * LOW_STOCK_PAGE_SIZE + 1}–
                      {Math.min(
                        lowStockPage * LOW_STOCK_PAGE_SIZE,
                        filteredLowStockItems.length,
                      )}{" "}
                      / {filteredLowStockItems.length}件
                    </span>

                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                      {/* 前へ */}
                      <button
                        onClick={() =>
                          setLowStockPage((p) => Math.max(1, p - 1))
                        }
                        disabled={lowStockPage === 1}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> 前へ
                      </button>

                      {/* 先頭ページ + 省略 */}
                      {start > 1 && (
                        <>
                          <button
                            onClick={() => setLowStockPage(1)}
                            className="min-w-[38px] h-9 rounded-lg text-xs font-bold border border-border bg-card hover:bg-secondary text-muted-foreground transition-all"
                          >
                            1
                          </button>
                          {start > 2 && (
                            <span className="text-muted-foreground text-sm px-1">
                              …
                            </span>
                          )}
                        </>
                      )}

                      {/* ページウィンドウ */}
                      {pageWindow.map((page) => (
                        <button
                          key={page}
                          onClick={() => setLowStockPage(page)}
                          className={`min-w-[38px] h-9 rounded-lg text-xs font-bold border transition-all ${
                            page === lowStockPage
                              ? "bg-primary text-black border-primary shadow-md"
                              : "bg-card border-border hover:bg-secondary text-muted-foreground"
                          }`}
                        >
                          {page}
                        </button>
                      ))}

                      {/* 末尾ページ + 省略 */}
                      {end < lowStockTotalPages && (
                        <>
                          {end < lowStockTotalPages - 1 && (
                            <span className="text-muted-foreground text-sm px-1">
                              …
                            </span>
                          )}
                          <button
                            onClick={() => setLowStockPage(lowStockTotalPages)}
                            className="min-w-[38px] h-9 rounded-lg text-xs font-bold border border-border bg-card hover:bg-secondary text-muted-foreground transition-all"
                          >
                            {lowStockTotalPages}
                          </button>
                        </>
                      )}

                      {/* 次へ */}
                      <button
                        onClick={() =>
                          setLowStockPage((p) =>
                            Math.min(lowStockTotalPages, p + 1),
                          )
                        }
                        disabled={lowStockPage === lowStockTotalPages}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-border bg-card hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-bold"
                      >
                        次へ <ChevronRight className="h-3.5 w-3.5" />
                      </button>

                      {/* ページ直接入力 */}
                      <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-border/50">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          ページ:
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={lowStockTotalPages}
                          value={lowStockPage}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            if (v >= 1 && v <= lowStockTotalPages)
                              setLowStockPage(v);
                          }}
                          className="w-14 h-9 text-center text-xs font-bold font-mono border border-border rounded-lg bg-card outline-none focus:ring-1 ring-primary transition-all"
                        />
                        <span className="text-[11px] text-muted-foreground">
                          / {lowStockTotalPages}
                        </span>
                      </div>
                    </div>
                    {/* 右側スペーサー（件数と対称） */}
                    <div className="invisible text-xs font-mono">
                      {(lowStockPage - 1) * LOW_STOCK_PAGE_SIZE + 1}–
                      {Math.min(
                        lowStockPage * LOW_STOCK_PAGE_SIZE,
                        filteredLowStockItems.length,
                      )}{" "}
                      / {filteredLowStockItems.length}件
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
