import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Request, Item, User } from "@/types";
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
} from "lucide-react";
import ItemFormModal from "@/components/ItemFormModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { toast } from "sonner";

const statusLabel: Record<Request["status"], string> = {
  pending: "未承認",
  approved: "承認済",
  rejected: "却下",
};

const statusStyle: Record<Request["status"], string> = {
  pending: "bg-primary/20 text-primary border-primary/20",
  approved: "bg-success/20 text-success border-success/20",
  rejected: "bg-destructive/20 text-destructive border-destructive/20",
};

const AdminPage = () => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]); // ユーザー情報を格納するステートを追加
  const [loading, setLoading] = useState(true);

  // --- 物品データの取得 ---
  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .order("id", { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast.error("物品データ取得失敗: " + error.message);
    }
  };

  // --- 申請データの取得 ---
  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      console.error("Requests fetch error:", error);
    }
  };

  // --- ユーザーデータの取得 ---
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Users fetch error:", error);
    }
  };

  // ページ読み込み時に一括取得
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchItems(), fetchRequests(), fetchUsers()]);
      setLoading(false);
    };
    init();
  }, []);

  // 物品管理用の状態
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  // --- 申請の承認・却下処理 ---
  const updateRequestStatus = async (id: number, status: Request["status"]) => {
    try {
      const { error } = await supabase
        .from("requests")
        .update({ status: status })
        .eq("id", id);
      if (error) throw error;
      toast.success(`ステータスを ${statusLabel[status]} に更新しました`);
      fetchRequests();
    } catch (error: any) {
      toast.error("更新失敗: " + error.message);
    }
  };

  const handleSaveItem = () => {
    fetchItems();
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
      fetchItems();
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

      {/* ── 物品データベースセクション ── */}
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

      {/* ── 物品出庫申請セクション ── */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-foreground">物品出庫申請</h3>
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[900px]">
              <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold">
                <tr>
                  <th className="px-4 py-4 w-20">申請ID</th>
                  <th className="px-4 py-4 w-24">状態</th>
                  <th className="px-4 py-4">申請者</th> {/* ★追加 */}
                  <th className="px-4 py-4">申請物品</th> {/* ★追加 */}
                  <th className="px-4 py-4 text-right">数量</th>
                  <th className="px-4 py-4">メモ</th>
                  <th className="px-4 py-4 text-center">判定</th>
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
                    const item = items.find((i) => i.id === req.item_id); // 物品名を紐付け
                    const user = users.find((u) => u.id === req.user_id); // ユーザー名を紐付け
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
                          {req.status === "pending" ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() =>
                                  updateRequestStatus(req.id, "approved")
                                }
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-success text-white text-xs font-bold hover:opacity-90 shadow-sm"
                              >
                                <CheckCircle className="h-3 w-3" /> 承認
                              </button>
                              <button
                                onClick={() =>
                                  updateRequestStatus(req.id, "rejected")
                                }
                                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive text-white text-xs font-bold hover:opacity-90 shadow-sm"
                              >
                                <XCircle className="h-3 w-3" /> 却下
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
