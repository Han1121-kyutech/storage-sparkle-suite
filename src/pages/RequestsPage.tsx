import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Request, Item, User } from "@/types";
import {
  Plus,
  X,
  Loader2,
  ClipboardCheck,
  Package,
  Hash,
  User as UserIcon,
  FileText,
  RotateCcw,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
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

type SortConfig = {
  key: keyof Request | "item_name" | "user_name";
  direction: "asc" | "desc";
};

const RequestsPage = () => {
  const { currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // 検索とソート用の状態
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "id",
    direction: "desc",
  });

  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [reqRes, itemRes, userRes] = await Promise.all([
        supabase.from("requests").select("*"),
        supabase.from("items").select("*").order("id", { ascending: true }),
        supabase.from("users").select("*"),
      ]);

      if (reqRes.error) throw reqRes.error;
      if (itemRes.error) throw itemRes.error;
      if (userRes.error) throw userRes.error;

      setRequests(reqRes.data || []);
      setItems(itemRes.data || []);
      setUsers(userRes.data || []);

      if (itemRes.data && itemRes.data.length > 0 && selectedItemId === 0) {
        setSelectedItemId(itemRes.data[0].id);
      }
    } catch (error: any) {
      toast.error("データの取得に失敗しました: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 検索とソートを適用したリクエスト一覧 ---
  const filteredAndSortedRequests = useMemo(() => {
    const isAdmin = (currentUser?.role ?? 0) >= 1;
    const baseRequests = isAdmin
      ? requests
      : requests.filter((r) => r.user_id === currentUser?.id);

    // 1. フィルタリング (物品名 or 申請者名)
    const filtered = baseRequests.filter((req) => {
      const itemName = items.find((i) => i.id === req.item_id)?.item_name ?? "";
      const userName = users.find((u) => u.id === req.user_id)?.user_name ?? "";
      const searchLower = searchTerm.toLowerCase();
      return (
        itemName.toLowerCase().includes(searchLower) ||
        userName.toLowerCase().includes(searchLower) ||
        (req.memo && req.memo.toLowerCase().includes(searchLower))
      );
    });

    // 2. ソート
    return [...filtered].sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortConfig.key === "item_name") {
        aVal = items.find((i) => i.id === a.item_id)?.item_name ?? "";
        bVal = items.find((i) => i.id === b.item_id)?.item_name ?? "";
      } else if (sortConfig.key === "user_name") {
        aVal = users.find((u) => u.id === a.user_id)?.user_name ?? "";
        bVal = users.find((u) => u.id === b.user_id)?.user_name ?? "";
      } else {
        aVal = a[sortConfig.key as keyof Request] ?? "";
        bVal = b[sortConfig.key as keyof Request] ?? "";
      }

      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [requests, items, users, currentUser, searchTerm, sortConfig]);

  const handleSort = (key: SortConfig["key"]) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (key: SortConfig["key"]) => {
    if (sortConfig.key !== key)
      return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );
  };

  // --- 既存の送信・返却ロジック ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const targetItem = items.find((i) => i.id === selectedItemId);
    if (targetItem && quantity > targetItem.stock_quantity) {
      toast.error(`在庫不足（最大: ${targetItem.stock_quantity}）。`);
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("requests")
        .insert([
          {
            item_id: selectedItemId,
            user_id: currentUser.id,
            request_quantity: quantity,
            memo: memo.trim(),
            status: "pending",
          },
        ]);
      if (error) throw error;
      toast.success("申請を送信しました。");
      setShowForm(false);
      setQuantity(1);
      setMemo("");
      fetchData();
    } catch (error: any) {
      toast.error("申請失敗: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (request: Request) => {
    try {
      const item = items.find((i) => i.id === request.item_id);
      if (!item) throw new Error("物品不明");
      const { error: itemError } = await supabase
        .from("items")
        .update({
          stock_quantity: item.stock_quantity + request.request_quantity,
        })
        .eq("id", item.id);
      if (itemError) throw itemError;
      const { error: reqError } = await supabase
        .from("requests")
        .update({ status: "returned" })
        .eq("id", request.id);
      if (reqError) throw reqError;
      toast.success(`返却完了しました。`);
      fetchData();
    } catch (error: any) {
      toast.error("返却失敗: " + error.message);
    }
  };

  const isAdmin = (currentUser?.role ?? 0) >= 1;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" /> 申請管理
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "全ユーザーの申請を監視中" : "あなたの申請履歴"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="物品名・申請者名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-1 ring-primary w-full sm:w-64 transition-all"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-sm"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? "中止" : "新規申請"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-xl bg-card border border-border shadow-md space-y-5 animate-in fade-in slide-in-from-top-4"
        >
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> 出庫申請を作成
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase opacity-50">
                対象物品
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-sm focus:ring-1 ring-primary outline-none"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} (現在庫: {item.stock_quantity})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase opacity-50">
                申請数量
              </label>
              <input
                type="number"
                min={1}
                value={quantity === 0 ? "" : quantity}
                onChange={(e) =>
                  setQuantity(
                    e.target.value === "" ? 0 : Number(e.target.value),
                  )
                }
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-sm focus:ring-1 ring-primary outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-[11px] font-bold uppercase opacity-50">
                備考・用途
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-sm focus:ring-1 ring-primary outline-none transition-all"
                placeholder="用途を入力"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="w-full sm:w-auto px-8 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "申請を送信"
            )}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[850px]">
            <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th
                  onClick={() => handleSort("id")}
                  className="px-4 py-4 w-20 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    ID {getSortIcon("id")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("item_name")}
                  className="px-4 py-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    物品 {getSortIcon("item_name")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("user_name")}
                  className="px-4 py-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    申請者 {getSortIcon("user_name")}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("request_quantity")}
                  className="px-4 py-4 text-right cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-end gap-1">
                    数量 {getSortIcon("request_quantity")}
                  </div>
                </th>
                <th className="px-4 py-4">備考</th>
                <th
                  onClick={() => handleSort("status")}
                  className="px-4 py-4 text-center cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    状態 {getSortIcon("status")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-20 font-mono opacity-50 animate-pulse"
                  >
                    SYNCING WITH DB...
                  </td>
                </tr>
              ) : filteredAndSortedRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-20 text-muted-foreground italic"
                  >
                    該当する申請が見当たりません。
                  </td>
                </tr>
              ) : (
                filteredAndSortedRequests.map((req) => {
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
                      <td className="px-4 py-4 text-foreground font-bold">
                        {item?.item_name ?? "不明（削除済み）"}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground text-xs">
                        <div className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {user?.user_name ?? "退会ユーザー"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-black">
                        {req.request_quantity}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px] truncate">
                          {req.memo ? (
                            <>
                              <FileText className="h-3 w-3 shrink-0" />{" "}
                              {req.memo}
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span
                            className={`inline-block px-3 py-1 rounded border text-[10px] font-black uppercase tracking-widest ${statusStyle[req.status]}`}
                          >
                            {statusLabel[req.status]}
                          </span>
                          {req.status === "approved" && (
                            <button
                              onClick={() => handleReturn(req)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-info/10 text-info hover:bg-info hover:text-white rounded text-[10px] font-bold shadow-sm transition-all active:scale-95"
                            >
                              <RotateCcw className="h-3 w-3" /> 返却する
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RequestsPage;
