// src/pages/ItemsPage.tsx
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Item, Request } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  sendInventoryNotification,
  sendRequestNotification,
} from "@/utils/notificationUtils";
import {
  Search,
  ChevronDown,
  ChevronRight,
  MapPin,
  Package,
  FileText,
  Plus,
  Loader2,
  Tag,
  PlusCircle,
  X,
  CalendarDays,
  ListChecks,
  CheckSquare,
  Square,
  Slash,
} from "lucide-react";
import { toast } from "sonner";

// 在庫数に応じたカラークラスを返す論理
const getStockColorClass = (quantity: number) => {
  if (quantity >= 15) return "text-success"; // 緑：安全
  if (quantity >= 5) return "text-warning"; // 黄：注意
  return "text-destructive font-black animate-pulse"; // 赤：警告（点滅）
};

type GroupedItem = {
  item_name: string;
  locations: Item[];
  total_stock: number;
  effective_stock: number;
};

const ItemsPage = () => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<number>>(
    new Set(),
  );

  const [isFormOpen, setIsFormOpen] = useState(window.innerWidth > 768);

  const [reservingItems, setReservingItems] = useState<Item[]>([]);
  const [resDate, setResDate] = useState("");
  const [resQtyMap, setResQtyMap] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const [newItem, setNewItem] = useState({
    item_name: "",
    label_no: "",
    specifications: "",
    location_name: "",
    location_no: "",
    stock_quantity: 0,
    memo: "",
  });

  const fetchData = async () => {
    const [itemRes, reqRes] = await Promise.all([
      supabase.from("items").select("*"),
      supabase
        .from("requests")
        .select("*")
        .in("status", ["approved", "pending"]),
    ]);
    if (!itemRes.error) setItems(itemRes.data || []);
    if (!reqRes.error) setRequests(reqRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const uniqueLocations = useMemo(() => {
    const locs = items.map((i) => i.location_name);
    return Array.from(new Set(locs)).sort();
  }, [items]);

  const calculateEffectiveStock = (itemId: number, currentStock: number) => {
    const reservedSum = requests
      .filter(
        (r) =>
          r.item_id === itemId &&
          (r.status === "approved" || r.status === "pending"),
      )
      .reduce((sum, r) => sum + r.request_quantity, 0);
    return Math.max(0, currentStock - reservedSum);
  };

  const toggleSelection = (itemId: number, isSelectable: boolean) => {
    if (!isSelectable) return;
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("items").insert([newItem]);
      if (error) throw error;
      toast.success("登録完了");
      if (window.innerWidth <= 768) setIsFormOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openReserveModal = (itemsToReserve: Item[]) => {
    setReservingItems(itemsToReserve);
    const initialQtys: Record<number, number> = {};
    itemsToReserve.forEach((i) => (initialQtys[i.id] = 1));
    setResQtyMap(initialQtys);
    setResDate("");
  };

  const handleReserveSubmit = async () => {
    if (reservingItems.length === 0 || !resDate) return;

    for (const item of reservingItems) {
      const eff = calculateEffectiveStock(item.id, item.stock_quantity);
      const qty = resQtyMap[item.id] || 0;
      if (qty <= 0) {
        toast.error(`数量を入力してください: ${item.item_name}`);
        return;
      }
      if (qty > eff) {
        toast.error(`在庫不足: ${item.item_name} (最大予約可能数: ${eff})`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const [y, m, d] = resDate.split("-");
      const dateStr = `${y}年${m}月${d}日`;
      const finalMemo = `【予約】使用予定日：${dateStr}`;

      const insertData = reservingItems.map((item) => ({
        item_id: item.id,
        user_id: currentUser?.id,
        request_quantity: resQtyMap[item.id],
        request_type: "checkout",
        status: "pending",
        scheduled_date: resDate,
        memo: finalMemo,
      }));

      const { error } = await supabase.from("requests").insert(insertData);
      if (error) throw error;

      const itemSummary = reservingItems
        .map((i) => `${i.item_name} x${resQtyMap[i.id]}`)
        .join("\n");
      await sendRequestNotification(
        `📅 **在庫予約 (${reservingItems.length}件)**\n予定日: ${dateStr}\n予約者: ${currentUser?.user_name}\n\n内容:\n${itemSummary}`,
      );

      toast.success("一括予約申請を完了しました");
      setReservingItems([]);
      setSelectedItemIds(new Set());
      setIsBulkMode(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const groupedItems: GroupedItem[] = useMemo(() => {
    const filtered = items.filter((i) => {
      const q = search.toLowerCase();
      const matchesSearch =
        i.item_name.toLowerCase().includes(q) ||
        i.location_no.toLowerCase().includes(q);
      const matchesLocation =
        selectedLocation === "all" || i.location_name === selectedLocation;
      return matchesSearch && matchesLocation;
    });

    const groups: Record<string, GroupedItem> = {};
    filtered.forEach((i) => {
      if (!groups[i.item_name])
        groups[i.item_name] = {
          item_name: i.item_name,
          locations: [],
          total_stock: 0,
          effective_stock: 0,
        };
      const eff = calculateEffectiveStock(i.id, i.stock_quantity);
      groups[i.item_name].locations.push(i);
      groups[i.item_name].total_stock += i.stock_quantity;
      groups[i.item_name].effective_stock += eff;
    });
    return Object.values(groups);
  }, [items, requests, search, selectedLocation]);

  return (
    <div className="space-y-6 pb-32 max-w-[1400px] mx-auto px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground tracking-tighter flex items-center gap-2">
            物品管理
            {isBulkMode && (
              <span className="text-xs bg-primary text-black px-2 py-0.5 rounded-full animate-pulse">
                選択モード
              </span>
            )}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            有効在庫：予約を除いたリアルタイムな数
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedItemIds(new Set());
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-bold ${isBulkMode ? "bg-primary text-black border-primary" : "bg-card border-border text-foreground"}`}
          >
            <ListChecks className="h-4 w-4" />{" "}
            {isBulkMode ? "モード終了" : "一括予約"}
          </button>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="検索..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm outline-none shadow-sm focus:ring-1 ring-primary"
            />
          </div>
          <div className="relative min-w-[160px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-70" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-sm font-bold appearance-none outline-none"
            >
              <option value="all">すべての場所</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="md:hidden">
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="w-full flex items-center justify-between p-4 bg-primary/5"
          >
            <span className="font-bold flex items-center gap-2">
              <Plus className="h-4 w-4" /> 新規物品登録
            </span>
            {isFormOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        {(isFormOpen || window.innerWidth > 768) && (
          <div className="p-5 border-t md:border-t-0">
            <form
              onSubmit={handleAddItem}
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50 uppercase">
                  物品名
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: マスキングテープ"
                  className="w-full bg-secondary/50 p-2 rounded text-sm outline-none"
                  onChange={(e) =>
                    setNewItem({ ...newItem, item_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50 uppercase">
                  ラベルNo
                </label>
                <input
                  type="text"
                  placeholder="例: DR-01"
                  className="w-full bg-secondary/50 p-2 rounded text-sm outline-none"
                  onChange={(e) =>
                    setNewItem({ ...newItem, label_no: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50 uppercase">
                  保管場所
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: 第1倉庫"
                  className="w-full bg-secondary/50 p-2 rounded text-sm outline-none"
                  onChange={(e) =>
                    setNewItem({ ...newItem, location_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50 uppercase">
                  棚番
                </label>
                <input
                  type="text"
                  required
                  placeholder="例: A-1"
                  className="w-full bg-secondary/50 p-2 rounded text-sm outline-none"
                  onChange={(e) =>
                    setNewItem({ ...newItem, location_no: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50 uppercase">
                  数量
                </label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  className="w-full bg-secondary/50 p-2 rounded text-sm outline-none"
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      stock_quantity: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-bold opacity-50 uppercase">
                  備考
                </label>
                <input
                  type="text"
                  placeholder="例: 実験用"
                  className="w-full bg-secondary/50 p-2 rounded text-sm outline-none"
                  onChange={(e) =>
                    setNewItem({ ...newItem, memo: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-black font-bold h-9 mt-5 rounded shadow-sm hover:opacity-90 active:scale-[0.98] transition-all lg:col-span-1"
              >
                登録
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {groupedItems.map((group) => {
          const isOpen = expandedIds.has(group.item_name);
          const effectiveColor = getStockColorClass(group.effective_stock);
          return (
            <div
              key={group.item_name}
              className="rounded-xl border border-border bg-card overflow-hidden shadow-sm"
            >
              <button
                onClick={() =>
                  setExpandedIds((prev) => {
                    const n = new Set(prev);
                    isOpen ? n.delete(group.item_name) : n.add(group.item_name);
                    return n;
                  })
                }
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <Package
                    className={`h-6 w-6 ${group.effective_stock < 5 ? "text-destructive animate-pulse" : "text-primary"}`}
                  />
                  <div className="text-left">
                    <div className="text-base font-black uppercase tracking-tight">
                      {group.item_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      計: {group.total_stock} |{" "}
                      <span className={effectiveColor}>
                        有効: {group.effective_stock}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className={`text-xl font-mono font-black ${effectiveColor}`}
                  >
                    {group.effective_stock}
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5 opacity-30" />
                  ) : (
                    <ChevronRight className="h-5 w-5 opacity-30" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border bg-secondary/5">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/20 text-[10px] font-bold uppercase text-muted-foreground">
                      <tr>
                        {isBulkMode && <th className="px-6 py-3 w-10"></th>}
                        <th className="px-6 py-3 w-16">ID</th>
                        <th className="px-6 py-3">場所 / 棚番</th>
                        <th className="px-6 py-3 text-right">有効在庫</th>
                        {!isBulkMode && (
                          <th className="px-6 py-3 text-center">操作</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {group.locations.map((loc) => {
                        const eff = calculateEffectiveStock(
                          loc.id,
                          loc.stock_quantity,
                        );
                        const isSelectable = eff > 0;
                        const isSelected = selectedItemIds.has(loc.id);
                        const colorClass = getStockColorClass(eff);

                        return (
                          <tr
                            key={loc.id}
                            className={`transition-colors ${isSelectable ? "hover:bg-secondary/20 cursor-pointer" : "opacity-40 cursor-not-allowed bg-secondary/5"} ${isSelected ? "bg-primary/5" : ""}`}
                            onClick={() =>
                              isBulkMode &&
                              isSelectable &&
                              toggleSelection(loc.id, isSelectable)
                            }
                          >
                            {isBulkMode && (
                              <td className="px-6 py-4">
                                {isSelectable ? (
                                  isSelected ? (
                                    <CheckSquare className="h-5 w-5 text-primary" />
                                  ) : (
                                    <Square className="h-5 w-5 opacity-20" />
                                  )
                                ) : (
                                  <Slash className="h-4 w-4 opacity-30" />
                                )}
                              </td>
                            )}
                            <td className="px-6 py-4 font-mono text-xs opacity-50">
                              #{loc.id}
                            </td>
                            <td className="px-6 py-4 font-bold">
                              <MapPin className="h-3 w-3 inline mr-1 opacity-50" />{" "}
                              {loc.location_name}{" "}
                              <span className="font-mono text-primary bg-primary/10 px-1 rounded">
                                {loc.location_no}
                              </span>
                            </td>
                            <td
                              className={`px-6 py-4 text-right font-mono font-bold ${colorClass}`}
                            >
                              {eff}
                            </td>
                            {!isBulkMode && (
                              <td className="px-6 py-4 text-center">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReserveModal([loc]);
                                  }}
                                  disabled={!isSelectable}
                                  className={`text-[10px] font-bold px-3 py-1 rounded transition-all ${isSelectable ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-black" : "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"}`}
                                >
                                  {isSelectable ? "予約" : "在庫切"}
                                </button>
                              </td>
                            )}
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

      {isBulkMode && selectedItemIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10">
          <div className="bg-black/90 backdrop-blur-md border border-primary/30 rounded-2xl p-4 shadow-2xl flex items-center gap-6 min-w-[320px]">
            <div className="text-white">
              <div className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                Selected
              </div>
              <div className="text-xl font-black">
                {selectedItemIds.size}{" "}
                <span className="text-[10px] font-medium opacity-50 uppercase">
                  items
                </span>
              </div>
            </div>
            <button
              onClick={() =>
                openReserveModal(items.filter((i) => selectedItemIds.has(i.id)))
              }
              className="flex-1 bg-primary text-black font-black py-3 rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
            >
              一括予約へ進む
            </button>
          </div>
        </div>
      )}

      {reservingItems.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-3xl p-6 border border-border shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> 予約申請
              </h3>
              <button
                onClick={() => setReservingItems([])}
                className="hover:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                使用予定日
              </label>
              <input
                type="date"
                max="9999-12-31"
                className="w-full bg-secondary/50 p-3.5 rounded-2xl outline-none border border-border focus:ring-1 ring-primary font-bold"
                value={resDate}
                onChange={(e) => setResDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                数量設定
              </label>
              <div className="space-y-2.5">
                {reservingItems.map((item) => {
                  const eff = calculateEffectiveStock(
                    item.id,
                    item.stock_quantity,
                  );
                  const currentVal = resQtyMap[item.id];
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-secondary/30 rounded-2xl border border-border/50"
                    >
                      <div className="flex-1 pr-4">
                        <div className="text-xs font-black line-clamp-1">
                          {item.item_name}
                        </div>
                        <div className="text-[9px] opacity-40 uppercase">
                          {item.location_name} - {item.location_no}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={eff}
                          className="w-20 bg-card border border-border rounded-lg p-2 text-center text-sm font-black focus:ring-1 ring-primary outline-none"
                          value={currentVal === 0 ? "" : currentVal}
                          onChange={(e) =>
                            setResQtyMap({
                              ...resQtyMap,
                              [item.id]:
                                e.target.value === ""
                                  ? 0
                                  : Number(e.target.value),
                            })
                          }
                          onFocus={(e) => e.target.select()}
                        />
                        <span className="text-[10px] font-bold opacity-30">
                          / {eff}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleReserveSubmit}
              disabled={submitting || !resDate}
              className="w-full bg-primary text-black font-black py-4 rounded-2xl shadow-xl hover:opacity-95 active:scale-[0.99] transition-all mt-4 disabled:opacity-30"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "予約を確定する"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
