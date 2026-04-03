import { useState, useEffect, useMemo } from "react";
import { downloadAsCSV } from "@/utils/exportUtils";
import { FileDown /* 既存のアイコン... */ } from "lucide-react";
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
  Search, // 追加
} from "lucide-react";
import ItemFormModal from "@/components/ItemFormModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
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
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());

  // 検索用の状態追加
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
      toast.error("データ同期失敗: " + error.message);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await reloadAll();
      setLoading(false);
    };
    init();
  }, []);

  // --- 物品データの検索・グループ化・並び替え ---
  const groupedItems = useMemo(() => {
    // まず検索フィルターを適用
    const filtered = items.filter(
      (item) =>
        item.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        item.location_name.toLowerCase().includes(itemSearch.toLowerCase()),
    );

    const groups: Record<string, GroupedAdminItem> = {};
    filtered.forEach((item) => {
      if (!groups[item.item_name]) {
        groups[item.item_name] = {
          item_name: item.item_name,
          locations: [],
          total_stock: 0,
        };
      }
      groups[item.item_name].locations.push(item);
      groups[item.item_name].total_stock += item.stock_quantity;
    });

    const result = Object.values(groups);

    result.sort((a, b) => {
      let aVal: any = a.item_name;
      let bVal: any = b.item_name;
      if (itemSort.key === "stock_quantity") {
        aVal = a.total_stock;
        bVal = b.total_stock;
      }
      if (aVal < bVal) return itemSort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return itemSort.direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, itemSort, itemSearch]);

  // --- 申請データの検索・並び替え ---
  const sortedRequests = useMemo(() => {
    // 申請者名または物品名でフィルタリング
    const filtered = requests.filter((req) => {
      const applicant =
        users.find((u) => u.id === req.user_id)?.user_name ?? "";
      const itemName = items.find((i) => i.id === req.item_id)?.item_name ?? "";
      const searchLower = requestSearch.toLowerCase();
      return (
        applicant.toLowerCase().includes(searchLower) ||
        itemName.toLowerCase().includes(searchLower)
      );
    });

    const data = [...filtered];
    data.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (requestSort.key === "user_name") {
        aVal = users.find((u) => u.id === a.user_id)?.user_name ?? "";
        bVal = users.find((u) => u.id === b.user_id)?.user_name ?? "";
      } else if (requestSort.key === "item_name") {
        aVal = items.find((i) => i.id === a.item_id)?.item_name ?? "";
        bVal = items.find((i) => i.id === b.item_id)?.item_name ?? "";
      } else {
        aVal = a[requestSort.key as keyof Request] ?? "";
        bVal = b[requestSort.key as keyof Request] ?? "";
      }

      if (aVal < bVal) return requestSort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return requestSort.direction === "asc" ? 1 : -1;
      return 0;
    });
    return data;
  }, [requests, requestSort, items, users, requestSearch]);

  const requestSortItems = (key: string) => {
    setItemSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const requestSortRequests = (key: string) => {
    setRequestSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (currentKey: string, config: SortConfig<any>) => {
    if (config.key !== currentKey)
      return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return config.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );
  };

  const toggleExpand = (name: string) => {
    setExpandedNames((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // --- 既存ロジック ---
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const updateRequestStatus = async (id: number, status: Request["status"]) => {
    const targetRequest = requests.find((r) => r.id === id);
    if (!targetRequest) return;
    try {
      const item = items.find((i) => i.id === targetRequest.item_id);
      if (!item) throw new Error("物品が見つかりません");

      if (status === "approved") {
        if (item.stock_quantity < targetRequest.request_quantity) {
          toast.error("在庫不足のため承認不可");
          return;
        }
        await supabase
          .from("items")
          .update({
            stock_quantity:
              item.stock_quantity - targetRequest.request_quantity,
          })
          .eq("id", item.id);
      } else if (status === "returned") {
        await supabase
          .from("items")
          .update({
            stock_quantity:
              item.stock_quantity + targetRequest.request_quantity,
          })
          .eq("id", item.id);
      }
      await supabase.from("requests").update({ status }).eq("id", id);
      toast.success(`ステータスを更新しました`);
      reloadAll();
    } catch (error: any) {
      toast.error("更新失敗: " + error.message);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono text-primary animate-pulse">
        LOADING...
      </div>
    );

  return (
    <div className="space-y-10 pb-20 px-1 sm:px-4">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2 tracking-tighter">
          <ClipboardList className="h-6 w-6 text-primary" /> 管理者パネル
        </h2>
        <p className="text-muted-foreground text-sm mt-1">物品管理と申請承認</p>
      </div>

      {/* 物品管理セクション */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 opacity-70" /> 物品データベース
          </h3>
          <div className="flex items-center gap-3">
            {/* 検索窓追加 */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="物品名・場所で検索..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-1 ring-primary w-full md:w-64 transition-all"
              />
            </div>

            <button
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 shadow-sm transition-all whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> 新規追加
            </button>
          </div>
        </div>

        {/* 物品テーブルヘッダー（ソート用） */}
        <div className="bg-secondary/30 rounded-t-xl border-x border-t border-border flex items-center text-[11px] font-bold uppercase text-muted-foreground px-4 py-3">
          <div className="flex-1 flex items-center gap-4">
            <div
              onClick={() => requestSortItems("item_name")}
              className="cursor-pointer hover:text-foreground flex items-center gap-1 transition-colors"
            >
              物品名 {getSortIcon("item_name", itemSort)}
            </div>
          </div>
          <div
            onClick={() => requestSortItems("stock_quantity")}
            className="w-32 text-right cursor-pointer hover:text-foreground flex items-center justify-end gap-1 transition-colors"
          >
            総在庫 {getSortIcon("stock_quantity", itemSort)}
          </div>
          <div className="w-24 px-4 invisible">操作</div>
        </div>

        <div className="space-y-2">
          {groupedItems.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground bg-card border border-border rounded-xl border-dashed">
              該当する物品は見つかりません
            </div>
          ) : (
            groupedItems.map((group) => {
              const isOpen = expandedNames.has(group.item_name);
              return (
                <div
                  key={group.item_name}
                  className="rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-all"
                >
                  <button
                    onClick={() => toggleExpand(group.item_name)}
                    className="w-full flex items-center justify-between px-4 py-4 hover:bg-secondary/20 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-bold text-foreground">
                        {group.item_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">
                        {group.locations.length} 箇所
                      </span>
                    </div>
                    <div
                      className={`font-mono font-black text-right w-32 ${group.total_stock < 10 ? "text-destructive" : "text-foreground"}`}
                    >
                      {group.total_stock}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border bg-secondary/10 animate-in slide-in-from-top-1">
                      <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/20">
                          <tr>
                            <th className="px-10 py-2">保管場所 / 棚番</th>
                            <th className="px-4 py-2 text-right w-24">在庫</th>
                            <th className="px-4 py-2">備考</th>
                            <th className="px-4 py-2 text-center w-28">操作</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {group.locations.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-secondary/30 transition-colors"
                            >
                              <td className="px-10 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3 opacity-50" />{" "}
                                    {item.location_name}
                                  </span>
                                  <span className="text-[10px] font-mono text-primary font-bold">
                                    No: {item.location_no}
                                  </span>
                                </div>
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono font-bold ${item.stock_quantity < 10 ? "text-destructive" : ""}`}
                              >
                                {item.stock_quantity}
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground italic">
                                {item.memo || "-"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingItem(item);
                                      setFormOpen(true);
                                    }}
                                    className="p-1.5 rounded bg-info/10 text-info hover:bg-info hover:text-white transition-all"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget(item)}
                                    className="p-1.5 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all"
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
            })
          )}
        </div>
      </section>

      {/* 申請管理セクション */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-foreground">物品出庫申請</h3>
          {/* 検索窓追加 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="申請者・物品名で検索..."
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-1 ring-primary w-full md:w-64 transition-all"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[900px]">
              <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold">
                <tr>
                  <th
                    onClick={() => requestSortRequests("id")}
                    className="px-4 py-4 w-20 cursor-pointer hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      ID {getSortIcon("id", requestSort)}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSortRequests("status")}
                    className="px-4 py-4 w-24 cursor-pointer hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      状態 {getSortIcon("status", requestSort)}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSortRequests("user_name")}
                    className="px-4 py-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      申請者 {getSortIcon("user_name", requestSort)}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSortRequests("item_name")}
                    className="px-4 py-4 cursor-pointer hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      物品 {getSortIcon("item_name", requestSort)}
                    </div>
                  </th>
                  <th
                    onClick={() => requestSortRequests("request_quantity")}
                    className="px-4 py-4 text-right cursor-pointer hover:text-foreground transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      数量 {getSortIcon("request_quantity", requestSort)}
                    </div>
                  </th>
                  <th className="px-4 py-4">メモ</th>
                  <th className="px-4 py-4 text-center">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sortedRequests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-muted-foreground italic"
                    >
                      該当する申請は見つかりません
                    </td>
                  </tr>
                ) : (
                  sortedRequests.map((req) => {
                    const item = items.find((i) => i.id === req.item_id);
                    const user = users.find(
                      (u) => String(u.id) === String(req.user_id),
                    );
                    return (
                      <tr
                        key={req.id}
                        className="hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-4 py-4 font-mono text-xs opacity-50">
                          #{req.id}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold border ${statusStyle[req.status]}`}
                          >
                            {statusLabel[req.status]}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <UserIcon className="h-3 w-3 text-muted-foreground" />
                            {user?.user_name ?? (
                              <span className="opacity-50 font-mono">
                                {req.user_id}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-bold text-primary">
                          {item?.item_name ?? "不明な物品"}
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-black">
                          {req.request_quantity}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {req.memo ? (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" /> {req.memo}
                              </span>
                            ) : (
                              "-"
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {!isSuperAdmin ? (
                            <div className="text-center text-[10px] text-muted-foreground italic">
                              閲覧のみ
                            </div>
                          ) : req.status === "pending" ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() =>
                                  updateRequestStatus(req.id, "approved")
                                }
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-success text-white text-xs font-bold hover:opacity-90 shadow-sm transition-all active:scale-95"
                              >
                                <CheckCircle className="h-3 w-3" /> 承認
                              </button>
                              <button
                                onClick={() =>
                                  updateRequestStatus(req.id, "rejected")
                                }
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive text-white text-xs font-bold hover:opacity-90 shadow-sm transition-all active:scale-95"
                              >
                                <XCircle className="h-3 w-3" /> 却下
                              </button>
                            </div>
                          ) : req.status === "approved" ? (
                            <div className="flex justify-center">
                              <button
                                onClick={() =>
                                  updateRequestStatus(req.id, "returned")
                                }
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-info text-white text-xs font-bold hover:opacity-90 shadow-sm transition-all active:scale-95"
                              >
                                <RotateCcw className="h-3 w-3" /> 返却を確認
                              </button>
                            </div>
                          ) : (
                            <div className="text-center text-[10px] text-muted-foreground italic">
                              処理済み
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
        </div>
      </section>

      <ItemFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSave={() => {
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
            const { error } = await supabase
              .from("items")
              .delete()
              .eq("id", deleteTarget.id);
            if (error) throw error;
            toast.success("削除しました");
            reloadAll();
          } catch (error: any) {
            toast.error("削除失敗: " + error.message);
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
