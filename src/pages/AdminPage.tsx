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
  const isSuperAdmin = (currentUser?.role ?? 0) >= 2;

  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // アコーディオンの開閉状態
  const [isItemsDatabaseOpen, setIsItemsDatabaseOpen] = useState(false); // 物品DBはデフォルト非表示
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set()); // 個別の物品開閉
  const [isPendingOpen, setIsPendingOpen] = useState(true); // 未処理申請はデフォルト表示
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
        aV = a[requestSort.key as keyof Request];
        bV = b[requestSort.key as keyof Request];
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
      if (s === "approved")
        await supabase
          .from("items")
          .update({ stock_quantity: i.stock_quantity - r.request_quantity })
          .eq("id", i.id);
      else if (s === "returned")
        await supabase
          .from("items")
          .update({ stock_quantity: i.stock_quantity + r.request_quantity })
          .eq("id", i.id);
      await supabase.from("requests").update({ status: s }).eq("id", id);

      const statusText =
        s === "approved"
          ? "✅ 承認"
          : s === "rejected"
            ? "❌ 却下"
            : "🔄 返却完了";

      await sendRequestNotification(
        `📢 **ステータス更新**\n対象者: ${users.find((u) => String(u.id) === String(r.user_id))?.user_name}\n物品: ${i.item_name}\n結果: ${statusText}`,
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

  const handleRequestSort = (
    key: keyof Request | "item_name" | "user_name",
  ) => {
    setRequestSort((p) => ({
      key,
      direction: p.key === key && p.direction === "asc" ? "desc" : "asc",
    }));
  };

  const renderRequestTable = (reqData: Request[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left min-w-[1000px]">
        <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold">
          <tr>
            <th
              onClick={() => handleRequestSort("id")}
              className="px-4 py-4 w-16 cursor-pointer"
            >
              ID {getSortIcon("id", requestSort)}
            </th>
            <th
              onClick={() => handleRequestSort("request_type")}
              className="px-4 py-4 w-24 cursor-pointer"
            >
              種別 {getSortIcon("request_type", requestSort)}
            </th>
            <th
              onClick={() => handleRequestSort("status")}
              className="px-4 py-4 w-24 cursor-pointer"
            >
              状態 {getSortIcon("status", requestSort)}
            </th>
            <th
              onClick={() => handleRequestSort("user_name")}
              className="px-4 py-4 cursor-pointer"
            >
              申請者 {getSortIcon("user_name", requestSort)}
            </th>
            <th
              onClick={() => handleRequestSort("item_name")}
              className="px-4 py-4 cursor-pointer"
            >
              物品 {getSortIcon("item_name", requestSort)}
            </th>
            <th
              onClick={() => handleRequestSort("request_quantity")}
              className="px-4 py-4 text-right cursor-pointer"
            >
              数量 {getSortIcon("request_quantity", requestSort)}
            </th>
            <th className="px-4 py-4">メモ</th>
            <th className="px-4 py-4 text-center">アクション</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {reqData.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="text-center py-10 text-muted-foreground italic"
              >
                該当データなし
              </td>
            </tr>
          ) : (
            reqData.map((r) => {
              const i = items.find((item) => item.id === r.item_id);
              const u = users.find(
                (user) => String(user.id) === String(r.user_id),
              );
              const rType = r.request_type || "checkout";

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
                      className={`px-2 py-1 rounded border text-[10px] font-bold ${typeStyle[rType]}`}
                    >
                      {typeLabel[rType]}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`px-2 py-1 rounded text-[10px] font-bold border ${statusStyle[r.status]}`}
                    >
                      {statusLabel[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-3 w-3 opacity-50" />
                      {u?.user_name || r.user_id}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-bold text-primary">
                    {i?.item_name || "不明"}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-black">
                    {r.request_quantity}
                  </td>
                  <td className="px-4 py-4 text-xs italic">{r.memo || "-"}</td>
                  <td className="px-4 py-4">
                    {!isSuperAdmin ? (
                      <div className="text-center text-[10px] italic opacity-50">
                        閲覧のみ
                      </div>
                    ) : r.status === "pending" ? (
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
                    ) : r.status === "approved" && rType === "checkout" ? (
                      <div className="flex justify-center">
                        <button
                          onClick={() => updateStatus(r.id, "returned")}
                          className="px-3 py-1.5 bg-info text-white rounded text-xs font-bold active:scale-95 transition-all"
                        >
                          返却確認
                        </button>
                      </div>
                    ) : (
                      <div className="text-center text-[10px] opacity-50">
                        処理済
                      </div>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono text-primary animate-pulse">
        LOADING...
      </div>
    );

  return (
    <div className="space-y-10 pb-20 px-1 sm:px-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold font-mono flex items-center gap-2 text-foreground">
          <ClipboardList className="h-6 w-6 text-primary" /> 管理者パネル
        </h2>
      </div>

      {/* 物品データベースセクション（全体をアコーディオン化） */}
      <section className="space-y-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <button
            onClick={() => setIsItemsDatabaseOpen(!isItemsDatabaseOpen)}
            className="w-full flex items-center justify-between p-4 bg-secondary/10 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Package className="h-5 w-5 text-primary opacity-70" />
              物品データベース
              <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary border text-[10px] font-black text-muted-foreground">
                全 {items.length} 種類
              </span>
            </div>
            {isItemsDatabaseOpen ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground opacity-50" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50" />
            )}
          </button>

          {isItemsDatabaseOpen && (
            <div className="p-4 border-t border-border space-y-4 animate-in slide-in-from-top-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="検索 (ラベル番号等)..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 rounded-lg bg-secondary/50 border text-sm w-full md:w-64"
                    />
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setIsExportModalOpen(!isExportModalOpen)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold shadow-sm active:scale-95 ${isExportModalOpen ? "bg-primary text-white" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
                    >
                      <FileDown className="h-4 w-4" />
                      <span className="hidden sm:inline">CSV出力</span>
                    </button>
                    {isExportModalOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsExportModalOpen(false)}
                        />
                        <div className="absolute left-0 md:right-0 mt-2 w-48 bg-card border rounded-xl shadow-xl z-20 p-2 animate-in fade-in zoom-in-95">
                          <p className="text-[10px] font-bold text-muted-foreground px-3 py-2 uppercase">
                            出力順を選択
                          </p>
                          <button
                            onClick={() => handleExport("item_name", "asc")}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary text-sm font-medium flex items-center justify-between"
                          >
                            物品名順{" "}
                            <ChevronUp className="h-3 w-3 opacity-50" />
                          </button>
                          <button
                            onClick={() =>
                              handleExport("stock_quantity", "desc")
                            }
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary text-sm font-medium flex items-center justify-between"
                          >
                            在庫の多い順{" "}
                            <ChevronDown className="h-3 w-3 opacity-50" />
                          </button>
                          <button
                            onClick={() => handleExport("id", "asc")}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary text-sm font-medium flex items-center justify-between"
                          >
                            登録順{" "}
                            <ArrowUpDown className="h-3 w-3 opacity-50" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setFormOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-black rounded-lg text-sm font-bold shadow-sm hover:opacity-90 w-full md:w-auto"
                >
                  <Plus className="h-4 w-4" /> 新規追加
                </button>
              </div>

              <div className="bg-secondary/30 rounded-t-xl border flex items-center text-[11px] font-bold uppercase text-muted-foreground px-4 py-3">
                <div className="flex-1 flex items-center gap-4">
                  <div
                    onClick={() =>
                      setItemSort((p) => ({
                        key: "item_name",
                        direction:
                          p.key === "item_name" && p.direction === "asc"
                            ? "desc"
                            : "asc",
                      }))
                    }
                    className="cursor-pointer hover:text-foreground"
                  >
                    物品名 {getSortIcon("item_name", itemSort)}
                  </div>
                </div>
                <div
                  onClick={() =>
                    setItemSort((p) => ({
                      key: "stock_quantity",
                      direction:
                        p.key === "stock_quantity" && p.direction === "asc"
                          ? "desc"
                          : "asc",
                    }))
                  }
                  className="w-32 text-right cursor-pointer hover:text-foreground flex items-center justify-end gap-1"
                >
                  総在庫 {getSortIcon("stock_quantity", itemSort)}
                </div>
                <div className="w-24 px-4 invisible">操作</div>
              </div>

              <div className="space-y-2">
                {groupedItems.map((g) => {
                  const open = expandedNames.has(g.item_name);
                  return (
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
                        className="w-full flex items-center justify-between px-4 py-4 hover:bg-secondary/20 text-left"
                      >
                        <div className="flex items-center gap-3">
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <span className="font-bold">{g.item_name}</span>
                          <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border">
                            {g.locations.length} 箇所
                          </span>
                        </div>
                        <div
                          className={`font-mono font-black text-right w-32 ${g.total_stock < 10 ? "text-destructive" : ""}`}
                        >
                          {g.total_stock}
                        </div>
                      </button>
                      {open && (
                        <div className="border-t bg-secondary/10">
                          <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/20">
                              <tr>
                                <th className="px-4 py-2 w-1/4">
                                  保管場所 / 棚番
                                </th>
                                <th className="px-4 py-2 w-1/4">
                                  ラベル / 規格
                                </th>
                                <th className="px-4 py-2 text-right w-16">
                                  在庫
                                </th>
                                <th className="px-4 py-2">備考</th>
                                <th className="px-4 py-2 text-center w-28">
                                  操作
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {g.locations.map((i) => (
                                <tr
                                  key={i.id}
                                  className="hover:bg-secondary/30 transition-colors"
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                      <span className="font-medium flex items-center gap-1">
                                        <MapPin className="h-3 w-3 opacity-50" />{" "}
                                        {i.location_name}
                                      </span>
                                      <span className="text-[10px] font-mono text-primary font-bold">
                                        No: {i.location_no}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-col gap-0.5">
                                      {i.label_no ? (
                                        <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20 w-fit flex items-center gap-1">
                                          <Tag className="h-2.5 w-2.5" />
                                          {i.label_no}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-muted-foreground italic">
                                          -
                                        </span>
                                      )}
                                      <span className="text-xs text-muted-foreground mt-0.5">
                                        {i.specifications || "-"}
                                      </span>
                                    </div>
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-right font-mono font-bold ${i.stock_quantity < 10 ? "text-destructive" : ""}`}
                                  >
                                    {i.stock_quantity}
                                  </td>
                                  <td className="px-4 py-3 text-xs italic">
                                    {i.memo || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex justify-center gap-2">
                                      <button
                                        onClick={() => {
                                          setEditingItem(i);
                                          setFormOpen(true);
                                        }}
                                        className="p-1.5 rounded bg-info/10 text-info hover:bg-info hover:text-white"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setDeleteTarget(i)}
                                        className="p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
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
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 物品出庫申請（アコーディオン化）セクション */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold">物品出庫申請の管理</h3>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="検索..."
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-secondary/50 border text-sm w-full md:w-64"
            />
          </div>
        </div>

        <div className="space-y-4">
          {/* 未処理のアコーディオン */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <button
              onClick={() => setIsPendingOpen(!isPendingOpen)}
              className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-primary">
                <AlertCircle className="h-5 w-5" />
                要対応: 承認待ちの申請
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary text-black text-[10px] font-black">
                  {pendingRequests.length}
                </span>
              </div>
              {isPendingOpen ? (
                <ChevronDown className="h-5 w-5 text-primary opacity-50" />
              ) : (
                <ChevronRight className="h-5 w-5 text-primary opacity-50" />
              )}
            </button>
            {isPendingOpen && (
              <div className="border-t border-border">
                {renderRequestTable(pendingRequests)}
              </div>
            )}
          </div>

          {/* 処理済みの履歴アコーディオン */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <button
              onClick={() => setIsProcessedOpen(!isProcessedOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-muted-foreground">
                <Archive className="h-5 w-5" />
                過去の履歴 (処理済み・却下・返却)
                <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary border text-[10px] font-black">
                  {processedRequests.length}
                </span>
              </div>
              {isProcessedOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground opacity-50" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-50" />
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
          if (!newItem) {
            reloadAll();
            setFormOpen(false);
            setEditingItem(null);
            return;
          }

          if (editingItem) {
            const diff: string[] = [];
            const fields = [
              { key: "item_name", label: "物品名" },
              { key: "label_no", label: "ラベル番号" },
              { key: "specifications", label: "規格" },
              { key: "location_name", label: "保管場所" },
              { key: "location_no", label: "棚番" },
              { key: "stock_quantity", label: "在庫数" },
              { key: "memo", label: "備考" },
            ] as const;

            fields.forEach(({ key, label }) => {
              const oldVal = editingItem[key as keyof Item];
              const newVal = newItem[key as keyof Item];
              if (oldVal !== newVal) {
                diff.push(
                  `${label}: ${oldVal || "なし"} → ${newVal || "なし"}`,
                );
              }
            });

            if (diff.length > 0) {
              sendInventoryNotification(
                `🛠️ **物品修正**\n物品名: ${editingItem.item_name}\n実行者: ${currentUser?.user_name}\n\n【変更内容】\n${diff.join("\n")}`,
              );
            }
          } else {
            sendInventoryNotification(
              `🆕 **新規登録**\n物品名: ${newItem.item_name}\nラベル: ${newItem.label_no || "なし"}\n規格: ${newItem.specifications || "なし"}\n場所: ${newItem.location_name}\n在庫: ${newItem.stock_quantity}\n実行者: ${currentUser?.user_name}`,
            );
          }
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
          try {
            await supabase.from("items").delete().eq("id", deleteTarget.id);

            await sendInventoryNotification(
              `🗑️ **物品削除**\n物品名: ${deleteTarget.item_name}\n場所: ${deleteTarget.location_name}\n実行者: ${currentUser?.user_name}`,
            );

            toast.success("削除完了");
            reloadAll();
          } catch (e: any) {
            toast.error(e.message);
          } finally {
            setDeleteTarget(null);
          }
        }}
        itemName={deleteTarget?.item_name ?? ""}
      />
    </div>
  );
};

export default AdminPage;
