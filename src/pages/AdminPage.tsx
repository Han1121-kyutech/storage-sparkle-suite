import { useState, useEffect } from "react";
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
  Hash,
  RotateCcw,
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

const AdminPage = () => {
  const { currentUser } = useAuth();
  const isSuperAdmin = (currentUser?.role ?? 0) >= 2;
  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const reloadAll = async () => {
    try {
      const [itemRes, reqRes, userRes] = await Promise.all([
        supabase.from("items").select("*").order("id", { ascending: true }),
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const updateRequestStatus = async (id: number, status: Request["status"]) => {
    const targetRequest = requests.find((r) => r.id === id);
    if (!targetRequest) return;

    try {
      const item = items.find((i) => i.id === targetRequest.item_id);
      if (!item) throw new Error("物品が見つかりません");

      // 在庫連動ロジック
      if (status === "approved") {
        if (item.stock_quantity < targetRequest.request_quantity) {
          toast.error("在庫不足のため承認不可");
          return;
        }
        const { error: itemError } = await supabase
          .from("items")
          .update({
            stock_quantity:
              item.stock_quantity - targetRequest.request_quantity,
          })
          .eq("id", item.id);
        if (itemError) throw itemError;
      } else if (status === "returned") {
        // 返却時は在庫を戻す
        const { error: itemError } = await supabase
          .from("items")
          .update({
            stock_quantity:
              item.stock_quantity + targetRequest.request_quantity,
          })
          .eq("id", item.id);
        if (itemError) throw itemError;
      }

      const { error: reqError } = await supabase
        .from("requests")
        .update({ status: status })
        .eq("id", id);
      if (reqError) throw reqError;

      toast.success(`ステータスを ${statusLabel[status]} に更新しました`);
      await reloadAll();
    } catch (error: any) {
      toast.error("更新失敗: " + error.message);
    }
  };

  const handleSaveItem = () => {
    reloadAll();
    setFormOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("items")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success(`${deleteTarget.item_name} を削除しました`);
      reloadAll();
    } catch (error: any) {
      toast.error("削除失敗: " + error.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono text-primary animate-pulse">
        LOADING DATABASE...
      </div>
    );

  return (
    <div className="space-y-10 pb-20 px-1 sm:px-4">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2 tracking-tighter">
          <ClipboardList className="h-6 w-6 text-primary" /> 管理者パネル
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          サークル全体の物品管理と申請承認
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 opacity-70" /> 物品データベース
          </h3>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" /> 新規追加
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[950px]">
              <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-4 w-16">ID</th>
                  <th className="px-4 py-4">物品名</th>
                  <th className="px-4 py-4">保管場所</th>
                  <th className="px-4 py-4 w-24 text-center">棚番</th>
                  <th className="px-4 py-4 w-24 text-right">在庫数</th>
                  <th className="px-4 py-4">備考</th>
                  <th className="px-4 py-4 w-28 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-secondary/30 transition-colors group"
                  >
                    <td className="px-4 py-4 font-mono text-xs opacity-50">
                      {item.id}
                    </td>
                    <td className="px-4 py-4 text-foreground font-bold">
                      {item.item_name}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {item.location_name}
                    </td>
                    <td className="px-4 py-4 text-center font-mono text-primary font-bold">
                      {item.location_no}
                    </td>
                    <td
                      className={`px-4 py-4 text-right font-mono font-black ${item.stock_quantity < 10 ? "text-destructive" : "text-foreground"}`}
                    >
                      {item.stock_quantity}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.memo ? (
                          <>
                            <FileText className="h-3 w-3 shrink-0" />{" "}
                            {item.memo}
                          </>
                        ) : (
                          "-"
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setFormOpen(true);
                          }}
                          className="p-2 rounded-lg bg-info/10 text-info hover:bg-info transition-all shadow-sm"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive transition-all shadow-sm"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">物品出庫申請</h3>
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[900px]">
              <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold">
                <tr>
                  <th className="px-4 py-4 w-20">ID</th>
                  <th className="px-4 py-4 w-24">状態</th>
                  <th className="px-4 py-4">申請者</th>
                  <th className="px-4 py-4">物品</th>
                  <th className="px-4 py-4 text-right">数量</th>
                  <th className="px-4 py-4">メモ</th>
                  <th className="px-4 py-4 text-center">アクション</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {requests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-10 text-muted-foreground italic"
                    >
                      申請はありません
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => {
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
        onSave={handleSaveItem}
        item={editingItem}
      />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteItem}
        itemName={deleteTarget?.item_name ?? ""}
      />
    </div>
  );
};

export default AdminPage;
