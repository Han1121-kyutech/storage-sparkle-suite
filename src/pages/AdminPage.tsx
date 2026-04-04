import React, { useState, useEffect, useMemo } from "react";
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
  Layers,
  Settings2,
  CheckSquare,
  Square,
} from "lucide-react";
import ItemFormModal from "@/components/ItemFormModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { downloadAsCSV } from "@/utils/exportUtils";
import {
  sendInventoryNotification,
  sendRequestNotification,
} from "@/utils/notificationUtils";
import { toast } from "sonner";

// 動的閾値に基づくカラークラス判定
const getStockColorClass = (quantity: number, threshold: number = 5) => {
  if (quantity >= threshold * 3) return "text-success";
  if (quantity >= threshold) return "text-warning";
  return "text-destructive font-black animate-pulse";
};

// 文字列（カテゴリ名）から一意な色を生成するロジック（Role 2の視覚的統制）
const getCategoryColor = (categoryName: string) => {
  const colors = [
    "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    "bg-purple-500/10 text-purple-500 border-purple-500/20",
    "bg-orange-500/10 text-orange-500 border-orange-500/20",
    "bg-pink-500/10 text-pink-500 border-pink-500/20",
    "bg-teal-500/10 text-teal-500 border-teal-500/20",
    "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    "bg-rose-500/10 text-rose-500 border-rose-500/20",
  ];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

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

// 申請種別のラベル定義
const typeLabel: Record<string, string> = {
  checkout: "貸出",
  consume: "消費",
  dispose: "廃棄",
};

// 申請種別の視覚スタイル
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
  alert_threshold: number;
  categories: string[];
};

type RequestGroup = {
  groupId: string;
  user_id: number;
  created_at: string;
  requests: Request[];
  isBulk: boolean;
};

const AdminPage = () => {
  const { currentUser } = useAuth();
  const isRole2 = currentUser?.role === 2;

  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [isItemsDatabaseOpen, setIsItemsDatabaseOpen] = useState(
    window.innerWidth > 1024,
  );
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isProcessedOpen, setIsProcessedOpen] = useState(false);

  const [itemSearch, setItemSearch] = useState("");
  const [selectedLocFilter, setSelectedLocFilter] = useState<string>("all");
  const [requestSearch, setRequestSearch] = useState("");
  const [itemSort, setItemSort] = useState<SortConfig<Item>>({
    key: "item_name",
    direction: "asc",
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const [isCategoryMode, setIsCategoryMode] = useState(false);
  const [selectedGroupNames, setSelectedGroupNames] = useState<Set<string>>(
    new Set(),
  );
  const [bulkCategoryName, setBulkCategoryName] = useState("");
  const [thresholdInput, setThresholdInput] = useState<Record<string, number>>(
    {},
  );

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

  const uniqueLocations = useMemo(
    () => Array.from(new Set(items.map((i) => i.location_name))).sort(),
    [items],
  );

  const handleExport = (sortKey: keyof Item) => {
    const sortedData = [...items].sort((a, b) => {
      let aVal = a[sortKey] ?? "";
      let bVal = b[sortKey] ?? "";
      if (typeof aVal === "string")
        return aVal.localeCompare(bVal as string, "ja");
      return (aVal as number) - (bVal as number);
    });
    downloadAsCSV(
      sortedData,
      `在庫リスト_${new Date().toISOString().split("T")[0]}`,
    );
    toast.success("CSV出力完了");
  };

  const handleUpdateThreshold = async (
    itemName: string,
    newThreshold: number,
  ) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("items")
        .update({ alert_threshold: newThreshold })
        .eq("item_name", itemName);
      if (error) throw error;
      toast.success(`${itemName} の警告閾値を ${newThreshold} に更新しました`);
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdateCategory = async (
    action: "add" | "remove" | "clear",
  ) => {
    if (selectedGroupNames.size === 0) return;
    const newCategory = bulkCategoryName.trim();
    if ((action === "add" || action === "remove") && !newCategory) {
      return toast.error("カテゴリ名を入力してください");
    }

    try {
      setLoading(true);
      const names = Array.from(selectedGroupNames);
      const targetItems = items.filter((i) => names.includes(i.item_name));

      for (const item of targetItems) {
        let existingCats = item.category
          ? item.category
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
          : [];

        if (action === "add") {
          if (!existingCats.includes(newCategory))
            existingCats.push(newCategory);
        } else if (action === "remove") {
          existingCats = existingCats.filter((c) => c !== newCategory);
        } else if (action === "clear") {
          existingCats = [];
        }

        const finalCategoryStr =
          existingCats.length > 0 ? existingCats.join(",") : null;
        await supabase
          .from("items")
          .update({ category: finalCategoryStr })
          .eq("id", item.id);
      }

      toast.success(`${names.length}件のグループのカテゴリを更新しました`);
      setIsCategoryMode(false);
      setSelectedGroupNames(new Set());
      setBulkCategoryName("");
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupSelection = (name: string) => {
    setSelectedGroupNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const groupedItems = useMemo(() => {
    const filtered = items.filter((i) => {
      const matchesSearch =
        i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (i.label_no &&
          i.label_no.toLowerCase().includes(itemSearch.toLowerCase())) ||
        (i.category &&
          i.category.toLowerCase().includes(itemSearch.toLowerCase()));
      const matchesLocation =
        selectedLocFilter === "all" || i.location_name === selectedLocFilter;
      return matchesSearch && matchesLocation;
    });

    const groups: Record<string, GroupedAdminItem> = {};
    filtered.forEach((i) => {
      if (!groups[i.item_name]) {
        const cats = i.category
          ? i.category
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean)
          : [];
        groups[i.item_name] = {
          item_name: i.item_name,
          locations: [],
          total_stock: 0,
          alert_threshold: i.alert_threshold ?? 5,
          categories: cats,
        };
      }
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
  }, [items, itemSort, itemSearch, selectedLocFilter]);

  const requestGroups = useMemo(() => {
    const groups: Record<string, RequestGroup> = {};
    requests.forEach((r) => {
      const gid = `${r.user_id}_${r.created_at}`;
      if (!groups[gid]) {
        groups[gid] = {
          groupId: gid,
          user_id: r.user_id as number,
          created_at: r.created_at as string,
          requests: [],
          isBulk: false,
        };
      }
      groups[gid].requests.push(r);
    });
    return Object.values(groups).map((g) => ({
      ...g,
      isBulk: g.requests.length > 1,
    }));
  }, [requests]);

  const filteredGroups = useMemo(() => {
    return requestGroups.filter((g) => {
      const u =
        users.find((user) => String(user.id) === String(g.user_id))
          ?.user_name || "";
      const matchesSearch = g.requests.some((r) =>
        items
          .find((item) => item.id === r.item_id)
          ?.item_name.toLowerCase()
          .includes(requestSearch.toLowerCase()),
      );
      return (
        u.toLowerCase().includes(requestSearch.toLowerCase()) || matchesSearch
      );
    });
  }, [requestGroups, users, items, requestSearch]);

  const pendingGroups = filteredGroups.filter((g) =>
    g.requests.some((r) => r.status === "pending"),
  );
  const processedGroups = filteredGroups.filter((g) =>
    g.requests.every((r) => r.status !== "pending"),
  );

  // グループ全体の一括更新
  const updateBulkStatus = async (
    group: RequestGroup,
    s: Request["status"],
  ) => {
    try {
      setLoading(true);
      const targetRequests = group.requests.filter((r) =>
        s === "returned" ? r.status === "approved" : r.status === "pending",
      );

      if (targetRequests.length === 0) return;

      for (const r of targetRequests) {
        const i = items.find((item) => item.id === r.item_id);
        if (!i) continue;
        if (s === "approved" && i.stock_quantity < r.request_quantity) {
          toast.error(`在庫不足: ${i.item_name}`);
          continue;
        }
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
        await supabase.from("requests").update({ status: s }).eq("id", r.id);
      }

      let statusText = "";
      let icon = "";
      if (s === "approved") {
        statusText = "承認";
        icon = "✅";
      } else if (s === "rejected") {
        statusText = "却下";
        icon = "❌";
      } else if (s === "returned") {
        statusText = "返却完了";
        icon = "🔙";
      }

      if (statusText) {
        const targetUser =
          users.find((u) => String(u.id) === String(group.user_id))
            ?.user_name || "不明";
        if (group.isBulk) {
          await sendRequestNotification(
            `${icon} **一括ステータス更新: ${statusText}**\n対象件数: ${targetRequests.length}件\n申請者: ${targetUser}\n処理者: ${currentUser?.user_name}`,
          );
        } else {
          const itm = items.find((i) => i.id === targetRequests[0].item_id);
          await sendRequestNotification(
            `${icon} **申請ステータス更新: ${statusText}**\n対象物品: ${itm?.item_name}\n申請者: ${targetUser}\n処理者: ${currentUser?.user_name}`,
          );
        }
      }

      toast.success("ステータスを更新しました");
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 個別の申請更新
  const updateSingleStatus = async (req: Request, s: Request["status"]) => {
    try {
      setLoading(true);
      const i = items.find((item) => item.id === req.item_id);
      if (!i) {
        toast.error("対象の物品が見つかりません");
        return;
      }

      if (s === "approved" && i.stock_quantity < req.request_quantity) {
        toast.error(`在庫不足: ${i.item_name}`);
        return;
      }

      if (s === "approved") {
        await supabase
          .from("items")
          .update({ stock_quantity: i.stock_quantity - req.request_quantity })
          .eq("id", i.id);
      } else if (s === "returned") {
        await supabase
          .from("items")
          .update({ stock_quantity: i.stock_quantity + req.request_quantity })
          .eq("id", i.id);
      }
      await supabase.from("requests").update({ status: s }).eq("id", req.id);

      let statusText = "";
      let icon = "";
      if (s === "approved") {
        statusText = "承認";
        icon = "✅";
      } else if (s === "rejected") {
        statusText = "却下";
        icon = "❌";
      } else if (s === "returned") {
        statusText = "返却完了";
        icon = "🔙";
      }

      if (statusText) {
        const targetUser =
          users.find((u) => String(u.id) === String(req.user_id))?.user_name ||
          "不明";
        await sendRequestNotification(
          `${icon} **個別ステータス更新: ${statusText}**\n対象物品: ${i.item_name}\n申請者: ${targetUser}\n処理者: ${currentUser?.user_name}`,
        );
      }

      toast.success(`${i.item_name}のステータスを更新しました`);
      reloadAll();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (gid: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });
  };

  const renderRequestTable = (groups: RequestGroup[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left min-w-[1000px]">
        <thead className="bg-secondary/50 text-muted-foreground uppercase text-[11px] font-bold">
          <tr>
            <th className="px-4 py-4 w-12 text-center">#</th>
            <th className="px-4 py-4 w-44">日時</th>
            <th className="px-4 py-4 w-40">申請者</th>
            <th className="px-4 py-4">内容</th>
            <th className="px-4 py-4 text-center">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {groups.map((g) => {
            const user = users.find((u) => String(u.id) === String(g.user_id));
            const isExpanded = expandedGroups.has(g.groupId);
            const isPending = g.requests.some((r) => r.status === "pending");
            const hasApproveCheckout = g.requests.some(
              (r) => r.status === "approved" && r.request_type === "checkout",
            );

            return (
              <React.Fragment key={g.groupId}>
                <tr
                  className={`hover:bg-secondary/20 transition-colors cursor-pointer ${g.isBulk ? "bg-primary/5 border-l-4 border-primary" : ""}`}
                  onClick={() => toggleGroup(g.groupId)}
                >
                  <td className="px-4 py-4 text-center">
                    {g.isBulk ? (
                      isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-30" />
                      )
                    ) : (
                      <FileText className="h-4 w-4 opacity-20" />
                    )}
                  </td>
                  <td className="px-4 py-4 text-[10px] font-mono">
                    {new Date(g.created_at).toLocaleString("ja-JP")}
                  </td>
                  <td className="px-4 py-4 font-bold">
                    {user?.user_name || "不明"}
                  </td>
                  <td className="px-4 py-4">
                    {g.isBulk ? (
                      <span className="text-xs italic text-muted-foreground flex items-center gap-2 font-bold">
                        <Layers className="h-3 w-3 text-primary" /> 一括申請 (
                        {g.requests.length}件)
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded border text-[9px] font-bold ${typeStyle[g.requests[0].request_type || "checkout"]}`}
                        >
                          {typeLabel[g.requests[0].request_type || "checkout"]}
                        </span>
                        <span className="font-bold text-foreground">
                          {
                            items.find((i) => i.id === g.requests[0].item_id)
                              ?.item_name
                          }
                          <span className="text-primary font-mono ml-1">
                            x{g.requests[0].request_quantity}
                          </span>
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div
                      className="flex justify-center gap-2 items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isPending && (
                        <>
                          {g.isBulk && (
                            <span className="text-[9px] font-bold text-muted-foreground mr-1">
                              一括操作:
                            </span>
                          )}
                          <button
                            onClick={() => updateBulkStatus(g, "approved")}
                            className="px-4 py-1 bg-success text-white rounded text-[10px] font-black shadow-md hover:scale-105 transition-all"
                          >
                            承認
                          </button>
                          <button
                            onClick={() => updateBulkStatus(g, "rejected")}
                            className="px-3 py-1 bg-destructive text-white rounded text-[10px] font-black shadow-md hover:scale-105 transition-all"
                          >
                            却下
                          </button>
                        </>
                      )}
                      {!isPending && hasApproveCheckout && (
                        <>
                          {g.isBulk && (
                            <span className="text-[9px] font-bold text-muted-foreground mr-1">
                              一括操作:
                            </span>
                          )}
                          <button
                            onClick={() => updateBulkStatus(g, "returned")}
                            className="px-4 py-1 bg-info text-white rounded text-[10px] font-black shadow-md hover:scale-105 transition-all"
                          >
                            返却
                          </button>
                        </>
                      )}
                      {!isPending && !hasApproveCheckout && (
                        <span className="px-2 py-1 rounded border text-[9px] font-black uppercase bg-secondary text-muted-foreground">
                          処理完了
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded &&
                  g.requests.map((r) => {
                    const itm = items.find((i) => i.id === r.item_id);
                    return (
                      <tr key={r.id} className="bg-secondary/5 text-xs">
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 font-mono text-[9px] opacity-40">
                          SUB: #{r.id}
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 border-l-2 border-primary/20">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[8px] font-black ${typeStyle[r.request_type || "checkout"]}`}
                            >
                              {typeLabel[r.request_type || "checkout"]}
                            </span>
                            <span className="font-bold">
                              {itm?.item_name}{" "}
                              <span className="text-primary font-mono ml-1">
                                x{r.request_quantity}
                              </span>
                            </span>
                            <span className="text-[10px] italic opacity-60">
                              (保管: {itm?.location_name})
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            備考: {r.memo || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center border-l border-border/10">
                          <div className="flex justify-center gap-1">
                            {r.status === "pending" ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateSingleStatus(r, "approved");
                                  }}
                                  className="px-2.5 py-1 bg-success/20 text-success border border-success/30 hover:bg-success hover:text-white rounded text-[10px] font-black transition-all"
                                >
                                  個別承認
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateSingleStatus(r, "rejected");
                                  }}
                                  className="px-2.5 py-1 bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive hover:text-white rounded text-[10px] font-black transition-all"
                                >
                                  却下
                                </button>
                              </>
                            ) : r.status === "approved" &&
                              r.request_type === "checkout" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateSingleStatus(r, "returned");
                                }}
                                className="px-2.5 py-1 bg-info/20 text-info border border-info/30 hover:bg-info hover:text-white rounded text-[10px] font-black transition-all"
                              >
                                個別返却
                              </button>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${statusStyle[r.status]}`}
                              >
                                {statusLabel[r.status]}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-8 pb-20 px-1 sm:px-4 max-w-[1400px] mx-auto relative">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-mono flex items-center gap-2 text-foreground tracking-tighter">
          <ClipboardList className="h-6 w-6 text-primary" /> ADMIN PANEL
        </h2>
      </div>

      <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-md">
        <button
          onClick={() => setIsItemsDatabaseOpen(!isItemsDatabaseOpen)}
          className="w-full flex items-center justify-between p-5 bg-secondary/10 hover:bg-secondary/20 transition-all"
        >
          <div className="flex items-center gap-3 font-black text-foreground">
            <Package className="h-5 w-5 text-primary" /> 物品データベース管理{" "}
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
          <div className="p-4 sm:p-6 border-t border-border space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="名前・ラベル・カテゴリ検索..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border text-sm outline-none focus:ring-1 ring-primary"
                  />
                </div>
                <div className="relative w-full sm:w-48">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-70" />
                  <select
                    value={selectedLocFilter}
                    onChange={(e) => setSelectedLocFilter(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-secondary/50 border text-sm font-bold appearance-none outline-none"
                  >
                    <option value="all">全拠点</option>
                    {uniqueLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30 pointer-events-none" />
                </div>
                <button
                  onClick={() => handleExport("item_name")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-xl text-xs font-bold border hover:bg-secondary/80 shadow-sm"
                >
                  <FileDown className="h-4 w-4" /> CSV出力
                </button>

                {isRole2 && (
                  <button
                    onClick={() => {
                      setIsCategoryMode(!isCategoryMode);
                      setSelectedGroupNames(new Set());
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${isCategoryMode ? "bg-primary text-black border-primary" : "bg-card text-foreground"}`}
                  >
                    <Settings2 className="h-4 w-4" />{" "}
                    {isCategoryMode ? "カテゴリ設定を終了" : "カテゴリ一括設定"}
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setFormOpen(true);
                }}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-black rounded-xl text-sm font-black shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <Plus className="h-5 w-5" /> 新規物品を追加
              </button>
            </div>

            <div className="space-y-3">
              {groupedItems.map((g) => {
                const totalColor = getStockColorClass(
                  g.total_stock,
                  g.alert_threshold,
                );
                const isSelected = selectedGroupNames.has(g.item_name);
                const isOpen = expandedNames.has(g.item_name);

                return (
                  <div
                    key={g.item_name}
                    className={`rounded-xl border overflow-hidden shadow-sm transition-colors ${isSelected ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                  >
                    <div
                      className={`w-full flex items-center justify-between p-4 ${!isCategoryMode && "hover:bg-secondary/20 cursor-pointer"}`}
                      onClick={() => {
                        if (isCategoryMode) {
                          toggleGroupSelection(g.item_name);
                        } else {
                          setExpandedNames((p) => {
                            const n = new Set(p);
                            isOpen ? n.delete(g.item_name) : n.add(g.item_name);
                            return n;
                          });
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        {isCategoryMode && (
                          <div
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => toggleGroupSelection(g.item_name)}
                              className="p-1"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 opacity-30 hover:opacity-100" />
                              )}
                            </button>
                          </div>
                        )}
                        <div className="text-left">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {g.categories.map((cat) => (
                              <span
                                key={cat}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getCategoryColor(cat)}`}
                              >
                                {cat}
                              </span>
                            ))}
                            <span className="font-bold text-sm uppercase tracking-tight ml-1">
                              {g.item_name}
                            </span>
                          </div>
                          <span className="text-[10px] opacity-40">
                            ({g.locations.length} locations)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div
                          className={`font-mono font-black text-lg ${totalColor}`}
                        >
                          {g.total_stock}
                        </div>

                        {isRole2 && !isCategoryMode && (
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-[10px] uppercase font-bold text-destructive opacity-80">
                              閾値:
                            </span>
                            <input
                              type="number"
                              min={0}
                              className="w-16 p-1 text-right text-xs border border-border rounded bg-secondary/50 font-mono outline-none focus:border-destructive focus:ring-1 ring-destructive"
                              value={
                                thresholdInput[g.item_name] ?? g.alert_threshold
                              }
                              onChange={(e) =>
                                setThresholdInput({
                                  ...thresholdInput,
                                  [g.item_name]: Number(e.target.value),
                                })
                              }
                              onFocus={(e) => e.target.select()}
                            />
                            <button
                              onClick={() =>
                                handleUpdateThreshold(
                                  g.item_name,
                                  thresholdInput[g.item_name] ??
                                    g.alert_threshold,
                                )
                              }
                              className="px-2.5 py-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded shadow-sm hover:opacity-90 active:scale-95 transition-all"
                            >
                              適用
                            </button>
                          </div>
                        )}

                        {!isCategoryMode &&
                          (isOpen ? (
                            <ChevronDown className="h-5 w-5 opacity-30" />
                          ) : (
                            <ChevronRight className="h-5 w-5 opacity-30" />
                          ))}
                      </div>
                    </div>

                    {isOpen && !isCategoryMode && (
                      <div className="border-t bg-secondary/5 overflow-x-auto">
                        <table className="w-full text-xs text-left min-w-[700px]">
                          <thead className="bg-secondary/20 text-muted-foreground uppercase font-bold">
                            <tr>
                              <th className="px-4 py-3">ID</th>
                              <th className="px-4 py-3">保管場所 / 棚番</th>
                              <th className="px-4 py-3">ラベル / 規格</th>
                              <th className="px-4 py-3 text-right">個別在庫</th>
                              <th className="px-4 py-3 text-center">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {g.locations.map((i) => {
                              const itemCats = i.category
                                ? i.category
                                    .split(",")
                                    .map((c) => c.trim())
                                    .filter(Boolean)
                                : [];
                              return (
                                <tr
                                  key={i.id}
                                  className="hover:bg-secondary/20 transition-colors"
                                >
                                  <td className="px-4 py-3 font-mono text-[10px] opacity-50">
                                    #{i.id}
                                  </td>
                                  <td className="px-4 py-3 font-medium">
                                    <MapPin className="h-3 w-3 inline mr-1 opacity-40" />{" "}
                                    {i.location_name}{" "}
                                    <span className="bg-primary/10 text-primary px-1 rounded font-mono">
                                      #{i.location_no}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {itemCats.map((cat) => (
                                        <span
                                          key={cat}
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${getCategoryColor(cat)}`}
                                        >
                                          {cat}
                                        </span>
                                      ))}
                                    </div>
                                    <div className="text-xs font-mono">
                                      {i.label_no && (
                                        <span className="bg-secondary p-1 rounded mr-2 border border-border/50 text-[10px]">
                                          {i.label_no}
                                        </span>
                                      )}
                                      <span className="opacity-70 italic font-sans">
                                        {i.specifications || "-"}
                                      </span>
                                    </div>
                                  </td>
                                  <td
                                    className={`px-4 py-3 text-right font-mono font-black ${getStockColorClass(i.stock_quantity, g.alert_threshold)}`}
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
                              );
                            })}
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
      </section>

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
              placeholder="名前・物品検索..."
              value={requestSearch}
              onChange={(e) => setRequestSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border text-sm outline-none focus:ring-1 ring-primary"
            />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/30 bg-card overflow-hidden shadow-lg">
            <button
              onClick={() => setIsPendingOpen(!isPendingOpen)}
              className="w-full flex items-center justify-between p-5 bg-primary/5 hover:bg-primary/10 transition-all"
            >
              <div className="flex items-center gap-3 font-black text-primary">
                <AlertCircle className="h-5 w-5" /> 承認待ちの申請{" "}
                <span className="bg-primary text-black text-[10px] px-2 py-0.5 rounded-full font-black">
                  {pendingGroups.length} グループ
                </span>
              </div>
              {isPendingOpen ? (
                <ChevronDown className="h-5 w-5 opacity-40" />
              ) : (
                <ChevronRight className="h-5 w-5 opacity-40" />
              )}
            </button>
            {isPendingOpen && renderRequestTable(pendingGroups)}
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-md">
            <button
              onClick={() => setIsProcessedOpen(!isProcessedOpen)}
              className="w-full flex items-center justify-between p-5 hover:bg-secondary/20 transition-all"
            >
              <div className="flex items-center gap-3 font-black text-muted-foreground">
                <Archive className="h-5 w-5" /> 処理済みの履歴{" "}
                <span className="bg-secondary px-2 py-0.5 rounded-full border text-[10px] font-black">
                  {processedGroups.length} グループ
                </span>
              </div>
              {isProcessedOpen ? (
                <ChevronDown className="h-5 w-5 opacity-40" />
              ) : (
                <ChevronRight className="h-5 w-5 opacity-40" />
              )}
            </button>
            {isProcessedOpen && renderRequestTable(processedGroups)}
          </div>
        </div>
      </section>

      {isCategoryMode && selectedGroupNames.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10">
          <div className="bg-black/90 backdrop-blur-md border border-primary/30 rounded-2xl p-4 shadow-2xl flex flex-col sm:flex-row items-center gap-4 min-w-[360px]">
            <div className="text-white flex gap-4 w-full sm:w-auto">
              <div>
                <div className="text-[10px] font-bold opacity-50 uppercase">
                  Selected
                </div>
                <div className="text-xl font-black">
                  {selectedGroupNames.size}{" "}
                  <span className="text-[10px] font-medium opacity-50 uppercase">
                    Groups
                  </span>
                </div>
              </div>
              <input
                type="text"
                placeholder="カテゴリ名 (例: 消耗品)"
                value={bulkCategoryName}
                onChange={(e) => setBulkCategoryName(e.target.value)}
                className="flex-1 bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary placeholder:text-white/30"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => handleBulkUpdateCategory("add")}
                className="flex-1 bg-primary text-black font-black px-4 py-2.5 rounded-lg shadow-lg hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                追加
              </button>
              <button
                onClick={() => handleBulkUpdateCategory("remove")}
                className="flex-1 bg-destructive text-white font-black px-4 py-2.5 rounded-lg shadow-lg hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                外す
              </button>
              <button
                onClick={() => handleBulkUpdateCategory("clear")}
                className="flex-1 bg-secondary text-white font-black px-4 py-2.5 rounded-lg shadow-lg hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                全消去
              </button>
            </div>
          </div>
        </div>
      )}

      <ItemFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingItem(null);
        }}
        onSave={() => {
          reloadAll();
          setFormOpen(false);
        }}
        item={editingItem}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await supabase.from("items").delete().eq("id", deleteTarget.id);

          await sendInventoryNotification(
            `🗑️ **物品削除**\n名前: ${deleteTarget.item_name}\n保管場所: ${deleteTarget.location_name}\nこの物品はシステムから完全に削除されました。`,
          );

          reloadAll();
          setDeleteTarget(null);
        }}
        itemName={deleteTarget?.item_name ?? ""}
      />
    </div>
  );
};

export default AdminPage;
