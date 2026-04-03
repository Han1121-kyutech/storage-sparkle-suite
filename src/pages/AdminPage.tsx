import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Request, Item, User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  FileText,
  ClipboardList,
  Package,
  User as UserIcon,
  RotateCcw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  MapPin,
  Search,
  FileDown,
  Tag,
  AlertCircle,
  Archive,
  CalendarDays,
} from "lucide-react";
import ItemFormModal from "@/components/ItemFormModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { downloadAsCSV } from "@/utils/exportUtils";
import {
  sendInventoryNotification,
  sendRequestNotification,
} from "@/utils/notificationUtils";
import { toast } from "sonner";

const statusLabel: Record<Request["status"], string> = {
  pending: "未承認",
  approved: "承認済",
  rejected: "却下",
  returned: "返却済",
};

const statusStyle: Record<Request["status"], string> = {
  pending: "bg-primary/20 text-primary border-primary/20",
  approved: "bg-success/20 text-success border-success/20",
  rejected: "bg-destructive/20 text-destructive border-destructive/20",
  returned: "bg-info/20 text-info border-info/20",
};

const typeLabel: Record<string, string> = {
  checkout: "貸出",
  consume: "消費",
  dispose: "廃棄",
};

const typeStyle: Record<string, string> = {
  checkout: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  consume: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  dispose: "bg-red-500/10 text-red-500 border-red-500/20",
};

type SortConfig<T> = {
  key: keyof T | string;
  direction: "asc" | "desc";
};

type GroupedAdminItem = {
  item_name: string;
  locations: Item[];
  total_stock: number;
};

const AdminPage = () => {
  const { currentUser } = useAuth();
  const isSuperAdmin = (currentUser?.role ?? 0) >= 1; // 簡易化のため1以上

  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [isItemsDatabaseOpen, setIsItemsDatabaseOpen] = useState(
    window.innerWidth > 1024,
  );
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isProcessedOpen, setIsProcessedOpen] = useState(false);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [itemSort, setItemSort] = useState<SortConfig<Item>>({
    key: "item_name",
    direction: "asc",
  });
  const [requestSort, setRequestSort] = useState<SortConfig<Request>>({
    key: "id",
    direction: "desc",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const reloadAll = async () => {
    try {
      const [itemRes, reqRes, userRes] = await Promise.all([
        supabase.from("items").select("*"),
        supabase
          .from("requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("users").select("*"),
      ]);
      setItems(itemRes.data || []);
      setRequests(reqRes.data || []);
      setUsers(userRes.data || []);
    } catch (error: any) {
      toast.error("同期失敗: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const handleExport = (
    sortKey: keyof Item,
    direction: "asc" | "desc" = "asc",
  ) => {
    const sortedData = [...items].sort((a, b) => {
      let aVal = a[sortKey] ?? "";
      let bVal = b[sortKey] ?? "";
      if (typeof aVal === "string") {
        return direction === "asc"
          ? aVal.localeCompare(bVal as string, "ja")
          : (bVal as string).localeCompare(aVal, "ja");
      }
      return direction === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    downloadAsCSV(sortedData, `在庫リスト_${sortKey}`);
    setIsExportModalOpen(false);
    toast.success("CSV出力完了");
  };

  const groupedItems = useMemo(() => {
    const filtered = items.filter(
      (i) =>
        i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        i.location_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (i.label_no &&
          i.label_no.toLowerCase().includes(itemSearch.toLowerCase())),
    );
    const groups: Record<string, GroupedAdminItem> = {};
    filtered.forEach((i) => {
      if (!groups[i.item_name])
        groups[i.item_name] = {
          item_name: i.item_name,
          locations: [],
          total_stock: 0,
        };
      groups[i.item_name].locations.push(i);
      groups[i.item_name].total_stock += i.stock_quantity;
    });
    return Object.values(groups).sort((a, b) => {
      let aV = itemSort.key === "stock_quantity" ? a.total_stock : a.item_name;
      let bV = itemSort.key === "stock_quantity" ? b.total_stock : b.item_name;
      return itemSort.direction === "asc"
        ? aV < bV
          ? -1
          : 1
        : aV > bV
          ? -1
          : 1;
    });
  }, [items, itemSort, itemSearch]);

  const sortedRequests = useMemo(() => {
    const filtered = requests.filter((r) => {
      const u =
        users.find((u) => String(u.id) === String(r.user_id))?.user_name ?? "";
      const i = items.find((i) => i.id === r.item_id)?.item_name ?? "";
      const typeName = typeLabel[r.request_type || "checkout"];
      return (
        u.toLowerCase().includes(requestSearch.toLowerCase()) ||
        i.toLowerCase().includes(requestSearch.toLowerCase()) ||
        typeName.toLowerCase().includes(requestSearch.toLowerCase())
      );
    });
    return [...filtered].sort((a, b) => {
      let aV: any, bV: any;
      if (requestSort.key === "user_name") {
        aV = users.find((u) => String(u.id) === String(a.user_id))?.user_name;
        bV = users.find((u) => String(u.id) === String(b.user_id))?.user_name;
      } else if (requestSort.key === "item_name") {
        aV = items.find((i) => i.id === a.item_id)?.item_name;
        bV = items.find((i) => i.id === b.item_id)?.item_name;
      } else {
        aV = a[requestSort.key as keyof Request] ?? "";
        bV = b[requestSort.key as keyof Request] ?? "";
      }
      return requestSort.direction === "asc"
        ? aV < bV
          ? -1
          : 1
        : aV > bV
          ? -1
          : 1;
    });
  }, [requests, requestSort, items, users, requestSearch]);

  const pendingRequests = sortedRequests.filter((r) => r.status === "pending");
  const processedRequests = sortedRequests.filter(
    (r) => r.status !== "pending",
  );

  const updateStatus = async (id: number, s: Request["status"]) => {
    const r = requests.find((req) => req.id === id);
    if (!r) return;
    try {
      const i = items.find((item) => item.id === r.item_id);
      if (!i) throw new Error("物品不明");
      if (s === "approved" && i.stock_quantity < r.request_quantity)
        return toast.error("在庫不足");

      if (s === "approved") {
        await supabase
          .from("items")
          .update({ stock_quantity: i.stock_quantity - r.request_quantity })
          .eq("id", i.id);
      } else if (s === "returned") {
        await supabase
          .from("items")
          .update({ stock_quantity: i.stock_quantity + r.request_quantity })
          .eq("id", i.id);
      }

      await supabase.from("requests").update({ status: s }).eq("id", id);
      const statusText =
        s === "approved"
          ? "✅ 承認"
          : s === "rejected"
            ? "❌ 却下"
            : "🔄 返却完了";
      await sendRequestNotification(
        `📢 **ステータス更新**\n対象者: ${users.find((u) => String(u.id) === String(r.user_id))?.user_name}\n物品: ${i.item_name}\n結果: ${statusText}${r.scheduled_date ? `\n(予約日: ${r.scheduled_date})` : ""}`,
      );
      toast.success("更新完了");
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getSortIcon = (k: string, c: SortConfig<any>) =>
    c.key !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-30" />
    ) : c.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );

  const renderRequestTable = (reqData: Request[]) => (
    <div className="overflow-x-auto">
      {/* PC: Table */}
      <table className="hidden md:table w-full text-sm text-left min-w-[1100px]">
        <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold">
          <tr>
            <th
              onClick={() =>
                setRequestSort((p) => ({
                  key: "id",
                  direction:
                    p.key === "id" && p.direction === "asc" ? "desc" : "asc",
                }))
              }
              className="px-4 py-4 w-16 cursor-pointer"
            >
              ID {getSortIcon("id", requestSort)}
            </th>
            <th className="px-4 py-4 w-24">種別</th>
            <th className="px-4 py-4 w-32">使用予定日</th>
            <th className="px-4 py-4">申請者</th>
            <th className="px-4 py-4 font-bold">物品</th>
            <th className="px-4 py-4 text-right">数量</th>
            <th className="px-4 py-4">メモ</th>
            <th className="px-4 py-4 text-center">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {reqData.map((r) => {
            const i = items.find((item) => item.id === r.item_id);
            const u = users.find(
              (user) => String(user.id) === String(r.user_id),
            );
            const isReservation = !!r.scheduled_date;
            return (
              <tr
                key={r.id}
                className="hover:bg-secondary/30 transition-colors"
              >
                <td className="px-4 py-4 font-mono text-xs opacity-50">
                  #{r.id}
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`px-2 py-1 rounded border text-[10px] font-bold ${typeStyle[r.request_type || "checkout"]}`}
                  >
                    {typeLabel[r.request_type || "checkout"]}
                  </span>
                </td>
                <td className="px-4 py-4">
                  {isReservation ? (
                    <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                      <CalendarDays className="h-3.5 w-3.5" />{" "}
                      {r.scheduled_date}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">
                      即時
                    </span>
                  )}
                </td>
                <td className="px-4 py-4 text-xs flex items-center gap-2">
                  <UserIcon className="h-3 w-3 opacity-50" />
                  {u?.user_name || "不明"}
                </td>
                <td className="px-4 py-4 font-bold text-primary">
                  {i?.item_name || "不明"}
                </td>
                <td className="px-4 py-4 text-right font-mono font-black">
                  {r.request_quantity}
                </td>
                <td className="px-4 py-4 text-xs italic">{r.memo || "-"}</td>
                <td className="px-4 py-4 text-center">
                  {r.status === "pending" ? (
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => updateStatus(r.id, "approved")}
                        className="px-3 py-1.5 bg-success text-white rounded text-xs font-bold active:scale-95"
                      >
                        承認
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, "rejected")}
                        className="px-3 py-1.5 bg-destructive text-white rounded text-xs font-bold active:scale-95"
                      >
                        却下
                      </button>
                    </div>
                  ) : r.status === "approved" &&
                    r.request_type === "checkout" ? (
                    <button
                      onClick={() => updateStatus(r.id, "returned")}
                      className="px-3 py-1.5 bg-info text-white rounded text-xs font-bold"
                    >
                      返却確認
                    </button>
                  ) : (
                    <span className="text-[10px] opacity-50">
                      {statusLabel[r.status]}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: Cards */}
      <div className="md:hidden divide-y divide-border/50">
        {reqData.map((r) => {
          const i = items.find((item) => item.id === r.item_id);
          const u = users.find((user) => String(user.id) === String(r.user_id));
          return (
            <div key={r.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono opacity-50">
                      #{r.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[9px] font-bold ${typeStyle[r.request_type || "checkout"]}`}
                    >
                      {typeLabel[r.request_type || "checkout"]}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-primary">
                    {i?.item_name || "不明"}
                  </div>
                  <div className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                    <UserIcon className="h-3 w-3" />
                    {u?.user_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[18px] font-black font-mono leading-none">
                    {r.request_quantity}
                  </div>
                  <div className="text-[9px] font-bold text-muted-foreground uppercase">
                    Quantity
                  </div>
                </div>
              </div>
              {r.scheduled_date && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 rounded border border-primary/20 text-primary text-[11px] font-bold">
                  <CalendarDays className="h-3.5 w-3.5" /> 予約日:{" "}
                  {r.scheduled_date}
                </div>
              )}
              {r.status === "pending" ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => updateStatus(r.id, "approved")}
                    className="py-2.5 bg-success text-white rounded-lg text-xs font-bold active:scale-95 shadow-sm"
                  >
                    承認する
                  </button>
                  <button
                    onClick={() => updateStatus(r.id, "rejected")}
                    className="py-2.5 bg-destructive text-white rounded-lg text-xs font-bold active:scale-95 shadow-sm"
                  >
                    却下
                  </button>
                </div>
              ) : r.status === "approved" && r.request_type === "checkout" ? (
                <button
                  onClick={() => updateStatus(r.id, "returned")}
                  className="w-full py-2.5 bg-info text-white rounded-lg text-xs font-bold"
                >
                  返却確認を完了する
                </button>
              ) : (
                <div className="text-center p-2 bg-secondary/50 rounded-lg text-[10px] font-bold text-muted-foreground uppercase">
                  {statusLabel[r.status]}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono text-primary animate-pulse">
        LOADING...
      </div>
    );

  return (
    <div className="space-y-8 pb-20 px-1 sm:px-4 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-mono flex items-center gap-2 text-foreground tracking-tighter">
          <ClipboardList className="h-6 w-6 text-primary" /> ADMIN PANEL
        </h2>
      </div>

      {/* 1. 物品データベース（PC・スマホ両対応） */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-md">
        <button
          onClick={() => setIsItemsDatabaseOpen(!isItemsDatabaseOpen)}
          className="w-full flex items-center justify-between p-5 bg-secondary/10 hover:bg-secondary/20 transition-all"
        >
          <div className="flex items-center gap-3 font-black text-foreground">
            <Package className="h-5 w-5 text-primary" /> 物品データベース管理
            <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full border">
              Total: {items.length}
            </span>
          </div>
          {isItemsDatabaseOpen ? (
            <ChevronDown className="h-5 w-5 opacity-40" />
          ) : (
            <ChevronRight className="h-5 w-5 opacity-40" />
          )}
        </button>

        {isItemsDatabaseOpen && (
          <div className="p-4 sm:p-6 border-t border-border space-y-6 animate-in slide-in-from-top-2">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="名前・ラベル・場所で検索..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border text-sm"
                  />
                </div>
                <div className="relative">
                  <button
                    onClick={() => setIsExportModalOpen(!isExportModalOpen)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-xl text-xs font-bold border hover:bg-secondary/80"
                  >
                    <FileDown className="h-4 w-4" /> CSV EXPORT
                  </button>
                  {isExportModalOpen && (
                    <div className="absolute left-0 mt-2 w-48 bg-card border rounded-xl shadow-2xl z-20 p-2">
                      <button
                        onClick={() => handleExport("item_name", "asc")}
                        className="w-full text-left p-2 hover:bg-secondary rounded text-xs font-medium"
                      >
                        物品名順
                      </button>
                      <button
                        onClick={() => handleExport("stock_quantity", "desc")}
                        className="w-full text-left p-2 hover:bg-secondary rounded text-xs font-medium"
                      >
                        在庫の多い順
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setFormOpen(true);
                }}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-black rounded-xl text-sm font-black shadow-lg hover:opacity-90 active:scale-95 transition-all"
              >
                <Plus className="h-5 w-5" /> 新規物品を追加
              </button>
            </div>

            <div className="space-y-3">
              {groupedItems.map((g) => (
                <div
                  key={g.item_name}
                  className="rounded-xl border bg-card overflow-hidden shadow-sm"
                >
                  <button
                    onClick={() =>
                      setExpandedNames((p) => {
                        const n = new Set(p);
                        n.has(g.item_name)
                          ? n.delete(g.item_name)
                          : n.add(g.item_name);
                        return n;
                      })
                    }
                    className="w-full flex items-center justify-between p-4 hover:bg-secondary/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm">{g.item_name}</span>
                      <span className="text-[10px] opacity-40">
                        ({g.locations.length} locations)
                      </span>
                    </div>
                    <div
                      className={`font-mono font-black text-lg ${g.total_stock < 5 ? "text-destructive" : "text-foreground"}`}
                    >
                      {g.total_stock}
                    </div>
                  </button>
                  {expandedNames.has(g.item_name) && (
                    <div className="border-t bg-secondary/5 overflow-x-auto">
                      <table className="w-full text-xs text-left min-w-[700px]">
                        <thead className="bg-secondary/20 text-muted-foreground uppercase font-bold">
                          <tr>
                            <th className="px-4 py-3">保管場所 / 棚番</th>
                            <th className="px-4 py-3">ラベル / 規格</th>
                            <th className="px-4 py-3 text-right">在庫</th>
                            <th className="px-4 py-3 text-center">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {g.locations.map((i) => (
                            <tr key={i.id} className="hover:bg-secondary/20">
                              <td className="px-4 py-3 font-medium">
                                <MapPin className="h-3 w-3 inline mr-1 opacity-40" />{" "}
                                {i.location_name}{" "}
                                <span className="bg-primary/10 text-primary px-1 rounded font-mono">
                                  #{i.location_no}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {i.label_no ? (
                                  <span className="bg-secondary px-1.5 py-0.5 rounded border mr-2 font-mono">
                                    {i.label_no}
                                  </span>
                                ) : (
                                  "-"
                                )}
                                {i.specifications}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono font-black ${i.stock_quantity < 5 ? "text-destructive" : ""}`}
                              >
                                {i.stock_quantity}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingItem(i);
                                      setFormOpen(true);
                                    }}
                                    className="p-1.5 bg-info/10 text-info rounded border border-info/20 hover:bg-info hover:text-white transition-all"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget(i)}
                                    className="p-1.5 bg-destructive/10 text-destructive rounded border border-destructive/20 hover:bg-destructive hover:text-white transition-all"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 2. 出庫申請管理セクション */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
          <h3 className="text-xl font-black text-foreground flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> REQUEST
            MANAGEMENT
          </h3>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="名前・物品・種別で検索..."
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border text-sm"
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* 承認待ち */}
          <div className="rounded-2xl border border-primary/30 bg-card overflow-hidden shadow-lg">
            <button
              onClick={() => setIsPendingOpen(!isPendingOpen)}
              className="w-full flex items-center justify-between p-5 bg-primary/5 hover:bg-primary/10 transition-all"
            >
              <div className="flex items-center gap-3 font-black text-primary">
                <AlertCircle className="h-5 w-5" /> 承認待ちの申請
                <span className="bg-primary text-black text-[10px] px-2 py-0.5 rounded-full font-black">
                  {pendingRequests.length}
                </span>
              </div>
              {isPendingOpen ? (
                <ChevronDown className="h-5 w-5 opacity-40" />
              ) : (
                <ChevronRight className="h-5 w-5 opacity-40" />
              )}
            </button>
            {isPendingOpen && (
              <div className="border-t border-border">
                {renderRequestTable(pendingRequests)}
              </div>
            )}
          </div>

          {/* 履歴 */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-md">
            <button
              onClick={() => setIsProcessedOpen(!isProcessedOpen)}
              className="w-full flex items-center justify-between p-5 hover:bg-secondary/20 transition-all"
            >
              <div className="flex items-center gap-3 font-black text-muted-foreground">
                <Archive className="h-5 w-5" /> 処理済みの履歴
                <span className="bg-secondary px-2 py-0.5 rounded-full border text-[10px] font-black">
                  {processedRequests.length}
                </span>
              </div>
              {isProcessedOpen ? (
                <ChevronDown className="h-5 w-5 opacity-40" />
              ) : (
                <ChevronRight className="h-5 w-5 opacity-40" />
              )}
            </button>
            {isProcessedOpen && (
              <div className="border-t border-border">
                {renderRequestTable(processedRequests)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* モーダル類 */}
      <ItemFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSave={(newItem?: Item) => {
          reloadAll();
          setFormOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
      />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await supabase.from("items").delete().eq("id", deleteTarget.id);
          reloadAll();
          setDeleteTarget(null);
        }}
        itemName={deleteTarget?.item_name ?? ""}
      />
    </div>
  );
};

export default AdminPage;
