import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  UserX,
  UserCheck,
  Loader2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const roleLabels: Record<number, string> = {
  0: "一般ユーザー",
  1: "管理者",
  2: "最高管理者",
};

type SortConfig = {
  key: keyof User | "status";
  direction: "asc" | "desc";
};

const UsersPage = () => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 並び替え状態の管理 (デフォルトはID昇順)
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "id",
    direction: "asc",
  });

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("users").select("*");
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error("ユーザー情報の取得に失敗: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- 並び替えロジック ---
  const sortedUsers = useMemo(() => {
    const sortableItems = [...users];
    sortableItems.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortConfig.key === "status") {
        aValue = a.is_active !== false ? 1 : 0;
        bValue = b.is_active !== false ? 1 : 0;
      } else {
        aValue = a[sortConfig.key as keyof User] ?? "";
        bValue = b[sortConfig.key as keyof User] ?? "";
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [users, sortConfig]);

  const requestSort = (key: SortConfig["key"]) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
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

  // --- 権限・凍結・一括操作ロジック (既存機能維持) ---
  const handleRoleChange = async (userId: string, newRole: number) => {
    if (userId === currentUser?.id)
      return toast.error("自分自身の権限は変更不可");
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
      toast.success("権限を更新しました");
      fetchUsers();
    } catch (error: any) {
      toast.error("更新失敗: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleActive = async (
    userId: string,
    currentActiveStatus: boolean,
  ) => {
    if (userId === currentUser?.id) return toast.error("自身を凍結不可");
    const newStatus = !currentActiveStatus;
    if (!confirm(`本当に${newStatus ? "復旧" : "凍結"}しますか？`)) return;
    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: newStatus })
        .eq("id", userId);
      if (error) throw error;
      toast.success(`${newStatus ? "復旧" : "凍結"}しました`);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(userId);
        return n;
      });
      fetchUsers();
    } catch (error: any) {
      toast.error("処理失敗: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkFreeze = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}人を一括凍結しますか？`)) return;
    setProcessingId("bulk");
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: false })
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      toast.success("一括凍結完了");
      setSelectedIds(new Set());
      fetchUsers();
    } catch (error: any) {
      toast.error("失敗: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSelect = (id: string) =>
    setSelectedIds((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const selectableUsers = users.filter(
    (u) => u.id !== currentUser?.id && u.is_active !== false,
  );
  const toggleSelectAll = () =>
    setSelectedIds(
      selectedIds.size === selectableUsers.length
        ? new Set()
        : new Set(selectableUsers.map((u) => u.id)),
    );
  const isAllSelected =
    selectableUsers.length > 0 && selectedIds.size === selectableUsers.length;

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh] font-mono text-primary animate-pulse">
        LOADING...
      </div>
    );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> ユーザー管理
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            見出しをクリックして並び替えが可能です
          </p>
        </div>
        <button
          onClick={handleBulkFreeze}
          disabled={selectedIds.size === 0 || processingId === "bulk"}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-sm active:scale-95"
        >
          {processingId === "bulk" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserX className="h-4 w-4" />
          )}
          一括凍結 ({selectedIds.size})
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold tracking-wider">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableUsers.length === 0}
                    className="rounded border-border text-primary"
                  />
                </th>
                <th
                  onClick={() => requestSort("status")}
                  className="px-4 py-4 w-16 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    状態 {getSortIcon("status")}
                  </div>
                </th>
                <th
                  onClick={() => requestSort("user_name")}
                  className="px-4 py-4 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    ユーザー名 {getSortIcon("user_name")}
                  </div>
                </th>
                <th
                  onClick={() => requestSort("role")}
                  className="px-4 py-4 w-40 cursor-pointer hover:text-foreground transition-colors"
                >
                  <div className="flex items-center gap-1">
                    権限 {getSortIcon("role")}
                  </div>
                </th>
                <th
                  onClick={() => requestSort("password")}
                  className="px-4 py-4 w-40 cursor-pointer hover:text-foreground transition-colors text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    パスワード {getSortIcon("password")}
                  </div>
                </th>
                <th className="px-4 py-4 w-28 text-center">個別操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedUsers.map((user) => {
                const isMe = user.id === currentUser?.id;
                const isActive = user.is_active !== false;
                return (
                  <tr
                    key={user.id}
                    className={`transition-colors ${!isActive ? "bg-destructive/5 opacity-75" : "hover:bg-secondary/30"}`}
                  >
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        disabled={isMe || !isActive}
                        className="rounded border-border"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div
                        className={`h-2.5 w-2.5 rounded-full mx-auto ${isActive ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-destructive"}`}
                      />
                    </td>
                    <td className="px-4 py-4 font-bold text-foreground">
                      {user.user_name}{" "}
                      {isMe && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] uppercase">
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        disabled={isMe || !isActive || processingId === user.id}
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, Number(e.target.value))
                        }
                        className="w-full px-2 py-1.5 rounded bg-secondary/50 border border-border text-xs font-bold"
                      >
                        <option value={0}>{roleLabels[0]}</option>
                        <option value={1}>{roleLabels[1]}</option>
                        <option value={2}>{roleLabels[2]}</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-center font-mono font-bold text-primary">
                      {user.role >= 1 ? user.password || "未設定" : "-"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(user.id, isActive)}
                        disabled={isMe || processingId === user.id}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-bold transition-colors ${isActive ? "bg-destructive/10 text-destructive hover:bg-destructive hover:text-white" : "bg-success/10 text-success hover:bg-success hover:text-white"}`}
                      >
                        {processingId === user.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : isActive ? (
                          <>
                            <UserX className="h-3 w-3" /> 凍結
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3 w-3" /> 復旧
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
