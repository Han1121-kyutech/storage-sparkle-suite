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
  Plus,
  Loader2,
  X,
  CalendarDays,
  ListChecks,
  CheckSquare,
  Square,
  Slash,
} from "lucide-react";
import { toast } from "sonner";

// 動的閾値に基づくカラークラス判定
const getStockColorClass = (quantity: number, threshold: number = 5) => {
  if (quantity >= threshold * 3) return "text-success";
  if (quantity >= threshold) return "text-warning";
  return "text-destructive font-black animate-pulse";
};

const typeLabel: Record<string, string> = {
  checkout: "貸出",
  consume: "消費",
  dispose: "廃棄",
};

type GroupedItem = {
  item_name: string;
  locations: Item[];
  total_stock: number;
  effective_stock: number;
  alert_threshold: number;
  category: string | null;
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
  // 追加: 個別種別・備考用のState
  const [resTypeMap, setResTypeMap] = useState<
    Record<number, Request["request_type"]>
  >({});
  const [resMemoMap, setResMemoMap] = useState<Record<number, string>>({});

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

  const uniqueLocations = useMemo(
    () => Array.from(new Set(items.map((i) => i.location_name))).sort(),
    [items],
  );

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

      await sendInventoryNotification(
        `✨ **新規物品登録**\n名前: ${newItem.item_name}\n保管場所: ${newItem.location_name}\n棚番: ${newItem.location_no}\n初期在庫: ${newItem.stock_quantity}\n登録者: ${currentUser?.user_name}`,
      );

      toast.success("登録完了");

      setNewItem({
        item_name: "",
        label_no: "",
        specifications: "",
        location_name: "",
        location_no: "",
        stock_quantity: 0,
        memo: "",
      });
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
    const initialTypes: Record<number, Request["request_type"]> = {};
    const initialMemos: Record<number, string> = {};

    itemsToReserve.forEach((i) => {
      initialQtys[i.id] = 1;
      initialTypes[i.id] = "checkout";
      initialMemos[i.id] = "";
    });

    setResQtyMap(initialQtys);
    setResTypeMap(initialTypes);
    setResMemoMap(initialMemos);
    setResDate(""); // 種別が混在するため日付は任意に変更
  };

  const handleReserveSubmit = async () => {
    if (reservingItems.length === 0) return;

    for (const item of reservingItems) {
      const eff = calculateEffectiveStock(item.id, item.stock_quantity);
      const qty = resQtyMap[item.id] || 0;
      if (qty <= 0) {
        toast.error(`数量を入力してください: ${item.item_name}`);
        return;
      }
      if (qty > eff) {
        toast.error(`在庫不足: ${item.item_name}`);
        return;
      }
      if (resTypeMap[item.id] === "dispose" && !resMemoMap[item.id].trim()) {
        toast.error(`廃棄理由は必須です: ${item.item_name}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const dateStr = resDate ? resDate.split("-").join("/") : "即時";

      const insertData = reservingItems.map((item) => {
        let finalMemo = resMemoMap[item.id].trim();
        if (resDate) {
          finalMemo = `【予定日:${dateStr}】${finalMemo ? ` / ${finalMemo}` : ""}`;
        }

        return {
          item_id: item.id,
          user_id: currentUser?.id,
          request_quantity: resQtyMap[item.id],
          request_type: resTypeMap[item.id],
          status: "pending",
          scheduled_date: resDate || null,
          memo: finalMemo,
        };
      });

      const { error } = await supabase.from("requests").insert(insertData);
      if (error) throw error;

      const summary = reservingItems
        .map(
          (i) =>
            `・[${typeLabel[resTypeMap[i.id] || "checkout"]}] ${i.item_name} (x${resQtyMap[i.id]}) [${i.location_name}]`,
        )
        .join("\n");

      await sendRequestNotification(
        `📝 **一括申請 (${reservingItems.length}件)**\n予定日: ${dateStr}\n申請者: ${currentUser?.user_name}\n\n【内容】\n${summary}`,
      );

      toast.success("一括申請を完了しました");
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
        i.location_no.toLowerCase().includes(q) ||
        (i.label_no && i.label_no.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q));
      const matchesLocation =
        selectedLocation === "all" || i.location_name === selectedLocation;
      return matchesSearch && matchesLocation;
    });

    const groups: Record<string, GroupedItem> = {};
    filtered.forEach((i) => {
      if (!groups[i.item_name]) {
        groups[i.item_name] = {
          item_name: i.item_name,
          locations: [],
          total_stock: 0,
          effective_stock: 0,
          alert_threshold: i.alert_threshold ?? 5,
          category: i.category || null,
        };
      }
      const eff = calculateEffectiveStock(i.id, i.stock_quantity);
      groups[i.item_name].locations.push(i);
      groups[i.item_name].total_stock += i.stock_quantity;
      groups[i.item_name].effective_stock += eff;
    });
    return Object.values(groups).sort((a, b) =>
      a.item_name.localeCompare(b.item_name),
    );
  }, [items, requests, search, selectedLocation]);

  return (
    <div className="space-y-6 pb-32 max-w-[1400px] mx-auto px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground tracking-tighter flex items-center gap-2">
            物品管理{" "}
            {isBulkMode && (
              <span className="text-xs bg-primary text-black px-2 py-0.5 rounded-full animate-pulse font-black">
                選択モード
              </span>
            )}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            有効在庫：他者の予約を除いた即時利用可能な数
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setIsBulkMode(!isBulkMode);
              setSelectedItemIds(new Set());
            }}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-bold shadow-sm ${isBulkMode ? "bg-primary text-black border-primary ring-2 ring-primary/20" : "bg-card border-border text-foreground hover:bg-secondary"}`}
          >
            <ListChecks className="h-4 w-4" />{" "}
            {isBulkMode ? "モード解除" : "一括申請を選択"}
          </button>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="検索（名前・棚番・カテゴリ）..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm outline-none focus:ring-1 ring-primary shadow-sm"
            />
          </div>
          <div className="relative min-w-[160px]">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-70" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-sm font-bold appearance-none outline-none shadow-sm cursor-pointer"
            >
              <option value="all">すべての拠点</option>
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
            <span className="font-bold flex items-center gap-2 text-sm">
              <Plus className="h-4 w-4 text-primary" /> 新規物品登録
            </span>
            {isFormOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        {(isFormOpen || window.innerWidth > 768) && (
          <div className="p-5 border-t md:border-t-0 bg-secondary/5">
            <form
              onSubmit={handleAddItem}
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs"
            >
              <div className="space-y-1.5">
                <label className="font-bold opacity-50 uppercase tracking-wider">
                  物品名
                </label>
                <input
                  type="text"
                  required
                  value={newItem.item_name}
                  disabled={submitting}
                  placeholder="物品の名称"
                  className="w-full bg-card p-2.5 rounded-lg outline-none border border-border focus:ring-1 ring-primary transition-all"
                  onChange={(e) =>
                    setNewItem({ ...newItem, item_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold opacity-50 uppercase tracking-wider">
                  ラベルNo
                </label>
                <input
                  type="text"
                  value={newItem.label_no}
                  disabled={submitting}
                  placeholder="管理番号があれば入力"
                  className="w-full bg-card p-2.5 rounded-lg outline-none border border-border focus:ring-1 ring-primary transition-all"
                  onChange={(e) =>
                    setNewItem({ ...newItem, label_no: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold opacity-50 uppercase tracking-wider">
                  保管場所
                </label>
                <input
                  type="text"
                  required
                  value={newItem.location_name}
                  disabled={submitting}
                  placeholder="倉庫名など"
                  className="w-full bg-card p-2.5 rounded-lg outline-none border border-border focus:ring-1 ring-primary transition-all"
                  onChange={(e) =>
                    setNewItem({ ...newItem, location_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold opacity-50 uppercase tracking-wider">
                  棚番
                </label>
                <input
                  type="text"
                  required
                  value={newItem.location_no}
                  disabled={submitting}
                  placeholder="配置エリア"
                  className="w-full bg-card p-2.5 rounded-lg outline-none border border-border focus:ring-1 ring-primary transition-all"
                  onChange={(e) =>
                    setNewItem({ ...newItem, location_no: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold opacity-50 uppercase tracking-wider">
                  初期在庫数
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  disabled={submitting}
                  value={
                    newItem.stock_quantity === 0 ? "" : newItem.stock_quantity
                  }
                  className="w-full bg-card p-2.5 rounded-lg outline-none border border-border focus:ring-1 ring-primary transition-all font-mono"
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      stock_quantity: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="font-bold opacity-50 uppercase tracking-wider">
                  備考/規格
                </label>
                <input
                  type="text"
                  value={newItem.specifications}
                  disabled={submitting}
                  placeholder="サイズ、色、用途など"
                  className="w-full bg-card p-2.5 rounded-lg outline-none border border-border focus:ring-1 ring-primary transition-all"
                  onChange={(e) =>
                    setNewItem({ ...newItem, specifications: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="bg-primary text-black font-black h-10 mt-5 rounded-lg shadow-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {submitting ? "登録中..." : "物品を追加する"}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {groupedItems.map((group) => {
          const isOpen = expandedIds.has(group.item_name);
          const effectiveColor = getStockColorClass(
            group.effective_stock,
            group.alert_threshold,
          );
          return (
            <div
              key={group.item_name}
              className={`rounded-xl border transition-all shadow-sm ${group.effective_stock < group.alert_threshold ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"}`}
            >
              <button
                onClick={() =>
                  setExpandedIds((p) => {
                    const n = new Set(p);
                    isOpen ? n.delete(group.item_name) : n.add(group.item_name);
                    return n;
                  })
                }
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-all"
              >
                <div className="flex items-center gap-4">
                  <Package
                    className={`h-6 w-6 ${group.effective_stock < group.alert_threshold ? "text-destructive animate-pulse" : "text-primary"}`}
                  />
                  <div className="text-left">
                    <div className="flex items-center gap-2 mb-0.5">
                      {group.category && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-tighter">
                          {group.category}
                        </span>
                      )}
                      <div className="text-base font-black uppercase tracking-tight text-foreground">
                        {group.item_name}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      在庫総数: {group.total_stock} |{" "}
                      <span className={effectiveColor}>
                        有効在庫: {group.effective_stock}
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
                <div className="border-t border-border bg-secondary/5 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/20 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                      <tr>
                        {isBulkMode && <th className="px-6 py-3 w-10"></th>}
                        <th className="px-6 py-3 w-16">ID</th>
                        <th className="px-6 py-3">保管場所 / 棚番</th>
                        <th className="px-6 py-3">ラベル / 規格</th>
                        <th className="px-6 py-3 text-right">有効数</th>
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
                            <td className="px-6 py-4 font-mono text-[10px] opacity-40">
                              #{loc.id}
                            </td>
                            <td className="px-6 py-4 font-bold">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 opacity-50" />{" "}
                                {loc.location_name}{" "}
                                <span className="font-mono text-primary bg-primary/5 px-1 rounded border border-primary/10">
                                  {loc.location_no}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono">
                              {loc.label_no && (
                                <span className="bg-secondary p-1 rounded mr-2 border border-border/50 text-[10px] font-bold">
                                  {loc.label_no}
                                </span>
                              )}
                              <span className="opacity-70 italic font-sans">
                                {loc.specifications || "-"}
                              </span>
                            </td>
                            <td
                              className={`px-6 py-4 text-right font-mono font-black ${getStockColorClass(eff, loc.alert_threshold ?? 5)}`}
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
                                  className={`text-[10px] font-black px-4 py-1.5 rounded-lg transition-all shadow-sm ${isSelectable ? "bg-primary text-black hover:opacity-90 active:scale-95" : "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"}`}
                                >
                                  {isSelectable ? "申請を作成" : "在庫なし"}
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
          <div className="bg-black/90 backdrop-blur-md border border-primary/30 rounded-2xl p-5 shadow-2xl flex items-center gap-8 min-w-[340px]">
            <div className="text-white">
              <div className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                Selected
              </div>
              <div className="text-2xl font-black">
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
              className="flex-1 bg-primary text-black font-black py-3.5 rounded-xl shadow-lg hover:opacity-95 active:scale-[0.98] transition-all text-sm uppercase tracking-tighter"
            >
              一括申請を確定する
            </button>
          </div>
        </div>
      )}

      {reservingItems.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-lg rounded-3xl p-6 border border-border shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-lg flex items-center gap-2 text-foreground">
                <CalendarDays className="h-5 w-5 text-primary" /> 申請フォーム
              </h3>
              <button
                onClick={() => setReservingItems([])}
                className="hover:opacity-50 p-1"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black opacity-50 uppercase tracking-widest ml-1">
                共通の使用予定日 (任意)
              </label>
              <input
                type="date"
                max="9999-12-31"
                className="w-full bg-secondary/30 p-3 rounded-2xl outline-none border border-border focus:ring-1 ring-primary font-black shadow-inner text-sm"
                value={resDate}
                onChange={(e) => setResDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-black opacity-50 uppercase tracking-widest ml-1">
                個別設定 (数量・種別・備考)
              </label>
              <div className="space-y-2.5">
                {reservingItems.map((item) => {
                  const eff = calculateEffectiveStock(
                    item.id,
                    item.stock_quantity,
                  );
                  const currentVal = resQtyMap[item.id];
                  const currentType = resTypeMap[item.id] || "checkout";
                  const currentMemo = resMemoMap[item.id] || "";

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 p-4 bg-secondary/20 rounded-2xl border border-border/50 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4 min-w-0">
                          <div className="text-sm font-black truncate text-foreground">
                            {item.item_name}
                          </div>
                          <div className="text-[9px] opacity-40 uppercase font-bold truncate">
                            {item.label_no || "NO LABEL"} | {item.location_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <input
                            type="number"
                            min={1}
                            max={eff}
                            className="w-16 bg-card border border-border rounded-xl p-2 text-center text-sm font-black focus:ring-1 ring-primary outline-none shadow-sm"
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
                          <span className="text-[10px] font-black opacity-20">
                            / {eff}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <select
                          className="w-28 bg-card border border-border rounded-xl p-2 text-xs font-bold outline-none focus:ring-1 ring-primary shadow-sm"
                          value={currentType}
                          onChange={(e) =>
                            setResTypeMap({
                              ...resTypeMap,
                              [item.id]: e.target
                                .value as Request["request_type"],
                            })
                          }
                        >
                          <option value="checkout">貸出/予約</option>
                          <option value="consume">消費</option>
                          <option value="dispose">廃棄</option>
                        </select>
                        <input
                          type="text"
                          placeholder={
                            currentType === "dispose"
                              ? "廃棄理由(必須)"
                              : "個別備考..."
                          }
                          className="flex-1 bg-card border border-border rounded-xl p-2 text-xs outline-none focus:ring-1 ring-primary shadow-sm"
                          value={currentMemo}
                          onChange={(e) =>
                            setResMemoMap({
                              ...resMemoMap,
                              [item.id]: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <button
              onClick={handleReserveSubmit}
              disabled={submitting}
              className="w-full bg-primary text-black font-black py-4 rounded-2xl shadow-xl hover:opacity-95 active:scale-[0.99] transition-all mt-4 disabled:opacity-30 uppercase tracking-tighter"
            >
              {submitting ? (
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              ) : (
                "この内容で申請を送信する"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
