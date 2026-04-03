import { useState, useEffect } from "react";
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

const RequestsPage = () => {
  const { currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [quantity, setQuantity] = useState(1);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [reqRes, itemRes, userRes] = await Promise.all([
        supabase
          .from("requests")
          .select("*")
          .order("created_at", { ascending: false }),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const targetItem = items.find((i) => i.id === selectedItemId);
    if (targetItem && quantity > targetItem.stock_quantity) {
      toast.error(
        `在庫不足（最大: ${targetItem.stock_quantity}）。無謀な申請は却下されます。`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("requests").insert([
        {
          item_id: selectedItemId,
          user_id: currentUser.id,
          request_quantity: quantity,
          memo: memo.trim(),
          status: "pending",
        },
      ]);

      if (error) throw error;

      toast.success("申請を送信しました。管理者の承認を待て。");
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

  // --- ユーザー自身による返却処理（在庫連動） ---
  const handleReturn = async (request: Request) => {
    try {
      const item = items.find((i) => i.id === request.item_id);
      if (!item) throw new Error("対象の物品が見つかりません");

      // 1. 在庫を加算して戻す
      const { error: itemError } = await supabase
        .from("items")
        .update({
          stock_quantity: item.stock_quantity + request.request_quantity,
        })
        .eq("id", item.id);
      if (itemError) throw itemError;

      // 2. 申請のステータスを「返却済」に更新する
      const { error: reqError } = await supabase
        .from("requests")
        .update({ status: "returned" })
        .eq("id", request.id);
      if (reqError) throw reqError;

      toast.success(`「${item.item_name}」を返却し、在庫を戻しました。`);
      fetchData();
    } catch (error: any) {
      toast.error("返却処理に失敗: " + error.message);
    }
  };

  // 権限の数値判定（roleが1以上なら管理者として扱う）
  const isAdmin = (currentUser?.role ?? 0) >= 1;

  const userRequests = isAdmin
    ? requests
    : requests.filter((r) => r.user_id === currentUser?.id);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" /> 申請管理
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "全ユーザーの申請を監視中" : "あなたの申請履歴"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-sm active:scale-95"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "キャンセル" : "新規申請"}
        </button>
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
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none cursor-pointer"
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
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none transition-all"
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
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none transition-all"
                placeholder="例: サークルイベントでの備品として使用"
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
                <th className="px-4 py-4 w-20">
                  <Hash className="h-3 w-3 inline mr-1" />
                  ID
                </th>
                <th className="px-4 py-4">
                  <Package className="h-3 w-3 inline mr-1" />
                  物品
                </th>
                <th className="px-4 py-4">
                  <UserIcon className="h-3 w-3 inline mr-1" />
                  申請者
                </th>
                <th className="px-4 py-4 text-right">数量</th>
                <th className="px-4 py-4">備考</th>
                <th className="px-4 py-4 text-center">ステータス</th>
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
              ) : userRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-20 text-muted-foreground font-medium italic"
                  >
                    履歴が見当たりません。
                  </td>
                </tr>
              ) : (
                userRequests.map((req) => {
                  const item = items.find((i) => i.id === req.item_id);
                  const user = users.find((u) => u.id === req.user_id);
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
                        {user?.user_name ?? "退会ユーザー"}
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
                          {/* 承認済みの場合のみ、ユーザー自身が返却できるボタンを表示 */}
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
