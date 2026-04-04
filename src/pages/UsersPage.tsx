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
import { sendInventoryNotification } from "@/utils/notificationUtils";

const roleLabels: Record<number, string> = {
  0: "一般ユーザー",
  1: "管理者",
  2: "最高管理者",
};

type SortConfig = {
  key: keyof User | "status" | "password";
  direction: "asc" | "desc";
};

const UsersPage = () => {
  const { currentUser } = useAuth();
  const isRole2 = currentUser?.role === 2;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "id",
    direction: "asc",
  });

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id, user_name, role, is_active, password");
      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error("ユーザー情報の取得に失敗しました: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const sortedUsers = useMemo(() => {
    const sortableItems = [...users];
    sortableItems.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortConfig.key === "status") {
        aValue = a.is_active !== false ? 1 : 0;
        bValue = b.is_active !== false ? 1 : 0;
      } else if (sortConfig.key === "password") {
        aValue = (a as any).password ?? "";
        bValue = (b as any).password ?? "";
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
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );
  };

  const handleRoleChange = async (userId: string, newRole: number) => {
    if (userId === String(currentUser?.id)) {
      return toast.error("自分自身の権限は変更できません");
    }

    const targetUser = users.find((u) => String(u.id) === userId);
    if (!targetUser) return;

    setProcessingId(userId);
    try {
      const updateData: any = { role: newRole };

      // ★ パスワード未設定のユーザーを管理者に昇格する場合、初期パスワード「admin123」を強制設定
      if (
        newRole >= 1 &&
        (!(targetUser as any).password ||
          (targetUser as any).password.trim() === "")
      ) {
        updateData.password = "admin123";
      }

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      await sendInventoryNotification(
        `👤 **権限変更**\n対象: ${targetUser.user_name}\n新権限: ${roleLabels[newRole]}\n実行者: ${currentUser?.user_name}`,
      );

      toast.success(
        `${targetUser.user_name} の権限を更新しました。` +
          (updateData.password ? " (初期PW: admin123 を自動設定しました)" : ""),
      );
      fetchUsers();
    } catch (error: any) {
      toast.error("更新に失敗しました: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleActive = async (
    userId: string,
    currentActiveStatus: boolean,
  ) => {
    if (userId === String(currentUser?.id)) {
      return toast.error("自分自身を凍結することはできません");
    }

    const newStatus = !currentActiveStatus;
    const actionText = newStatus ? "復旧" : "凍結";

    if (!confirm(`本当にこのユーザーを${actionText}しますか？`)) return;

    setProcessingId(userId);
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: newStatus })
        .eq("id", userId);

      if (error) throw error;

      const target = users.find((u) => String(u.id) === userId);
      await sendInventoryNotification(
        `🛡️ **アカウント状態変更**\n対象: ${target?.user_name}\n状態: ${actionText}\n実行者: ${currentUser?.user_name}`,
      );

      toast.success(`${target?.user_name} を${actionText}しました`);

      if (!newStatus) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }

      fetchUsers();
    } catch (error: any) {
      toast.error(`${actionText}に失敗しました: ` + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkFreeze = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`選択された ${selectedIds.size} 名を一括で凍結しますか？`))
      return;

    setProcessingId("bulk");
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: false })
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      await sendInventoryNotification(
        `🚫 **一括アカウント凍結実行**\n対象件数: ${selectedIds.size}名\n実行者: ${currentUser?.user_name}`,
      );

      toast.success("一括凍結処理が完了しました");
      setSelectedIds(new Set());
      fetchUsers();
    } catch (error: any) {
      toast.error("一括処理に失敗しました: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectableUsers = users.filter((u) => {
    const isMe = String(u.id) === String(currentUser?.id);
    const isFrozen = u.is_active === false;
    return !isMe && !isFrozen;
  });

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableUsers.map((u) => String(u.id))));
    }
  };

  const isAllSelected =
    selectableUsers.length > 0 && selectedIds.size === selectableUsers.length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="font-mono text-sm text-primary animate-pulse">
          LOADING USER DATABASE...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> ユーザー管理
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            管理者権限の付与およびアカウントの有効/無効を制御します。
          </p>
        </div>
        <button
          onClick={handleBulkFreeze}
          disabled={selectedIds.size === 0 || processingId === "bulk"}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-destructive text-white rounded-xl text-sm font-black hover:opacity-90 disabled:opacity-30 transition-all shadow-lg shadow-destructive/20 active:scale-95"
        >
          {processingId === "bulk" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserX className="h-4 w-4" />
          )}
          一括凍結を実行 ({selectedIds.size})
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableUsers.length === 0}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                </th>
                <th
                  onClick={() => requestSort("status")}
                  className="px-4 py-4 w-20 cursor-pointer hover:text-foreground transition-colors group"
                >
                  <div className="flex items-center justify-center gap-1">
                    状態 {getSortIcon("status")}
                  </div>
                </th>
                <th
                  onClick={() => requestSort("user_name")}
                  className="px-4 py-4 cursor-pointer hover:text-foreground transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    ユーザー名 {getSortIcon("user_name")}
                  </div>
                </th>
                <th
                  onClick={() => requestSort("role")}
                  className="px-4 py-4 w-40 cursor-pointer hover:text-foreground transition-colors group"
                >
                  <div className="flex items-center gap-1">
                    権限レベル {getSortIcon("role")}
                  </div>
                </th>
                <th
                  onClick={() => requestSort("password")}
                  className="px-4 py-4 w-32 cursor-pointer hover:text-foreground transition-colors group text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    パスワード {getSortIcon("password")}
                  </div>
                </th>
                <th className="px-6 py-4 w-32 text-center font-bold tracking-wider">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedUsers.map((user) => {
                const isMe = String(user.id) === String(currentUser?.id);
                const isActive = user.is_active !== false;
                const pwd = (user as any).password;

                return (
                  <tr
                    key={user.id}
                    className={`transition-colors ${!isActive ? "bg-destructive/5 opacity-70 italic" : "hover:bg-secondary/30"}`}
                  >
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(String(user.id))}
                        onChange={() => toggleSelect(String(user.id))}
                        disabled={isMe || !isActive}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div
                        className={`h-3 w-3 rounded-full mx-auto ${isActive ? "bg-success shadow-[0_0_10px_rgba(34,197,94,0.4)]" : "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.4)]"}`}
                        title={isActive ? "有効" : "凍結中"}
                      />
                    </td>
                    <td className="px-4 py-4 font-black text-foreground">
                      <div className="flex items-center gap-2">
                        {user.user_name}
                        {isMe && (
                          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-black uppercase tracking-tighter">
                            Your Account
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        disabled={
                          !isRole2 || isMe || processingId === String(user.id)
                        }
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(
                            String(user.id),
                            Number(e.target.value),
                          )
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-secondary/50 border border-border text-xs font-black focus:ring-1 ring-primary outline-none appearance-none cursor-pointer disabled:cursor-not-allowed"
                      >
                        <option value={0}>{roleLabels[0]}</option>
                        <option value={1}>{roleLabels[1]}</option>
                        <option value={2}>{roleLabels[2]}</option>
                      </select>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {user.role >= 1 ? (
                        <span className="font-mono text-xs font-bold text-foreground bg-secondary/50 px-2 py-1 rounded border border-border/50">
                          {pwd || (
                            <span className="text-destructive font-sans text-[10px]">
                              未設定
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground opacity-30">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() =>
                          handleToggleActive(String(user.id), isActive)
                        }
                        disabled={
                          !isRole2 || isMe || processingId === String(user.id)
                        }
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black transition-all ${
                          !isRole2 || isMe
                            ? "opacity-20 cursor-not-allowed"
                            : isActive
                              ? "bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
                              : "bg-success/10 text-success hover:bg-success hover:text-white"
                        }`}
                      >
                        {processingId === String(user.id) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isActive ? (
                          <>
                            <UserX className="h-3.5 w-3.5" /> 凍結
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" /> 復旧
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
