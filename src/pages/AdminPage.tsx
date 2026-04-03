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
} from "lucide-react";
import ItemFormModal from "@/components/ItemFormModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { downloadAsCSV } from "@/utils/exportUtils";
import {
  sendInventoryNotification,
  sendRequestNotification,
} from "@/utils/notificationUtils";
import { toast } from "sonner";

// 在庫数に応じたカラークラスを返す論理（実利的な視認性を確保）
const getStockColorClass = (quantity: number) => {
  if (quantity >= 15) return "text-success"; // 緑：安全
  if (quantity >= 5) return "text-warning"; // 黄：注意
  return "text-destructive font-black animate-pulse"; // 赤：警告（点滅で強調）
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

type RequestGroup = {
  groupId: string;
  user_id: number;
  created_at: string;
  requests: Request[];
  isBulk: boolean;
};

const AdminPage = () => {
  const { currentUser } = useAuth();
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
    downloadAsCSV(sortedData, `在庫リスト_${sortKey}`);
    toast.success("CSV出力完了");
  };

  const groupedItems = useMemo(() => {
    const filtered = items.filter((i) => {
      const matchesSearch =
        i.item_name.toLowerCase().includes(itemSearch.toLowerCase()) ||
        (i.label_no &&
          i.label_no.toLowerCase().includes(itemSearch.toLowerCase()));
      const matchesLocation =
        selectedLocFilter === "all" || i.location_name === selectedLocFilter;
      return matchesSearch && matchesLocation;
    });

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

  const updateBulkStatus = async (
    group: RequestGroup,
    s: Request["status"],
  ) => {
    try {
      setLoading(true);
      const targetRequests = group.requests.filter((r) =>
        s === "returned" ? r.status === "approved" : r.status === "pending",
      );

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

      toast.success("ステータスを更新しました");
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
                        <Layers className="h-3 w-3 text-primary" /> 一括予約申請
                        ({g.requests.length}件)
                      </span>
                    ) : (
                      <span className="font-bold text-foreground">
                        {
                          items.find((i) => i.id === g.requests[0].item_id)
                            ?.item_name
                        }{" "}
                        <span className="text-primary font-mono ml-1">
                          x{g.requests[0].request_quantity}
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    {isPending ? (
                      <div
                        className="flex justify-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => updateBulkStatus(g, "approved")}
                          className="px-4 py-1.5 bg-success text-white rounded text-[10px] font-black shadow-md hover:scale-105 transition-all"
                        >
                          一括承認
                        </button>
                        <button
                          onClick={() => updateBulkStatus(g, "rejected")}
                          className="px-3 py-1.5 bg-destructive text-white rounded text-[10px] font-black shadow-md hover:scale-105 transition-all"
                        >
                          却下
                        </button>
                      </div>
                    ) : g.requests.some(
                        (r) =>
                          r.status === "approved" &&
                          r.request_type === "checkout",
                      ) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateBulkStatus(g, "returned");
                        }}
                        className="px-4 py-1.5 bg-info text-white rounded text-[10px] font-black shadow-md hover:scale-105 transition-all"
                      >
                        一括返却
                      </button>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded border text-[9px] font-black uppercase ${statusStyle[g.requests[0].status]}`}
                      >
                        {statusLabel[g.requests[0].status]}
                      </span>
                    )}
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
                          <div className="flex items-center gap-4">
                            <span className="font-bold">
                              {itm?.item_name}{" "}
                              <span className="text-primary font-mono ml-1">
                                x{r.request_quantity}
                              </span>
                            </span>
                            <span className="text-[10px] italic opacity-60">
                              ラベル: {itm?.label_no || "-"} | 規格:{" "}
                              {itm?.specifications || "-"}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            備考: {r.memo || "-"}
                          </div>
                          {r.scheduled_date && (
                            <div className="text-[9px] text-primary flex items-center gap-1 mt-0.5 font-bold">
                              <CalendarDays className="h-3 w-3" /> 予約日:{" "}
                              {r.scheduled_date}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2"></td>
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
    <div className="space-y-8 pb-20 px-1 sm:px-4 max-w-[1400px] mx-auto">
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
                    placeholder="名前・ラベル検索..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border text-sm outline-none"
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
                const totalColor = getStockColorClass(g.total_stock);
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
                      className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm uppercase tracking-tight">
                          {g.item_name}
                        </span>
                        <span className="text-[10px] opacity-40">
                          ({g.locations.length} locations)
                        </span>
                      </div>
                      <div
                        className={`font-mono font-black text-lg ${totalColor}`}
                      >
                        {g.total_stock}
                      </div>
                    </button>
                    {expandedNames.has(g.item_name) && (
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
                            {g.locations.map((i) => (
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
                                <td className="px-4 py-3 text-xs font-mono">
                                  {i.label_no && (
                                    <span className="bg-secondary p-1 rounded mr-2 border border-border/50 text-[10px]">
                                      {i.label_no}
                                    </span>
                                  )}
                                  <span className="opacity-70 italic font-sans">
                                    {i.specifications || "-"}
                                  </span>
                                </td>
                                <td
                                  className={`px-4 py-3 text-right font-mono font-black ${getStockColorClass(i.stock_quantity)}`}
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
          reloadAll();
          setDeleteTarget(null);
        }}
        itemName={deleteTarget?.item_name ?? ""}
      />
    </div>
  );
};

export default AdminPage;
