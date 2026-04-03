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
} from "lucide-react";
import { toast } from "sonner";

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // PCなら初期状態でフォームを開き、スマホなら閉じる
  const [isFormOpen, setIsFormOpen] = useState(window.innerWidth > 768);

  const [reservingItem, setReservingItem] = useState<Item | null>(null);
  const [resDate, setResDate] = useState("");
  const [resQty, setResQty] = useState(1);
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
    const handleResize = () => {
      if (window.innerWidth > 768) setIsFormOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase.from("items").insert([newItem]);
      if (error) throw error;

      await sendInventoryNotification(
        `🆕 **新規登録**\n物品名: ${newItem.item_name}\n場所: ${newItem.location_name}\n在庫: ${newItem.stock_quantity}\n実行者: ${currentUser?.user_name}`,
      );

      toast.success("登録完了");
      if (window.innerWidth <= 768) setIsFormOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReserve = async () => {
    if (!reservingItem || !resDate) return;
    setSubmitting(true);
    try {
      // メモの自動構成ロジック
      const [y, m, d] = resDate.split("-");
      const dateStr = `${y}年${m}月${d}日`;
      const finalMemo = `【予約】使用予定日：${dateStr}`;

      const { error } = await supabase.from("requests").insert([
        {
          item_id: reservingItem.id,
          user_id: currentUser?.id,
          request_quantity: resQty,
          request_type: "checkout",
          status: "pending",
          scheduled_date: resDate,
          memo: finalMemo,
        },
      ]);
      if (error) throw error;

      await sendRequestNotification(
        `📅 **在庫予約**\n物品: ${reservingItem.item_name}\n予定日: ${dateStr}\n数量: ${resQty}\n予約者: ${currentUser?.user_name}`,
      );

      toast.success("予約申請完了");
      setReservingItem(null);
      setResDate("");
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
      return (
        i.item_name.toLowerCase().includes(q) ||
        i.location_name.toLowerCase().includes(q) ||
        (i.label_no && i.label_no.toLowerCase().includes(q))
      );
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
  }, [items, requests, search]);

  return (
    <div className="space-y-6 pb-20 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground tracking-tighter">
            物品管理
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            有効在庫：予約を除き、今すぐ持ち出せる実数
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="物品名・ラベル・場所で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm focus:ring-1 ring-primary outline-none shadow-sm"
          />
        </div>
      </div>

      {/* 新規登録セクション */}
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
            <h3 className="hidden md:flex items-center gap-2 text-sm font-bold mb-4 opacity-70">
              <PlusCircle className="h-4 w-4" /> 新規物品データベース登録
            </h3>
            <form
              onSubmit={handleAddItem}
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50">
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
                <label className="text-[10px] font-bold opacity-50">
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
                <label className="text-[10px] font-bold opacity-50">
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
                <label className="text-[10px] font-bold opacity-50">棚番</label>
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
                <label className="text-[10px] font-bold opacity-50">数量</label>
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
                <label className="text-[10px] font-bold opacity-50">備考</label>
                <input
                  type="text"
                  placeholder="例: 実験で使用、イベント用"
                  className="w-full bg-secondary/50 p-2 rounded text-sm outline-none"
                  onChange={(e) =>
                    setNewItem({ ...newItem, memo: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-black font-bold h-9 mt-5 rounded shadow-sm hover:opacity-90 active:scale-95 transition-all lg:col-span-1"
              >
                登録
              </button>
            </form>
          </div>
        )}
      </div>

      {/* リストエリア */}
      <div className="grid grid-cols-1 gap-4">
        {groupedItems.map((group) => {
          const isOpen = expandedIds.has(group.item_name);
          const low = group.effective_stock < 5;
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
                className="w-full flex items-center justify-between p-4 hover:bg-secondary/20"
              >
                <div className="flex items-center gap-4">
                  <Package
                    className={`h-6 w-6 ${low ? "text-destructive" : "text-primary"}`}
                  />
                  <div className="text-left">
                    <div className="text-base font-black">
                      {group.item_name}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      TOTAL: {group.total_stock} | LOCATIONS:{" "}
                      {group.locations.length}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[10px] font-bold opacity-50 uppercase">
                      Effective
                    </div>
                    <div
                      className={`text-xl font-mono font-black ${low ? "text-destructive" : "text-success"}`}
                    >
                      {group.effective_stock}
                    </div>
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
                  {/* PC: Table */}
                  <div className="hidden md:block">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-secondary/20 text-[10px] font-bold uppercase text-muted-foreground">
                        <tr>
                          <th className="px-6 py-3 w-16">ID</th>
                          <th className="px-6 py-3">場所 / 棚番</th>
                          <th className="px-6 py-3">ラベル / 規格</th>
                          <th className="px-6 py-3 text-right">
                            有効 / 実在庫
                          </th>
                          <th className="px-6 py-3 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {group.locations.map((loc) => (
                          <tr key={loc.id} className="hover:bg-secondary/20">
                            <td className="px-6 py-4 font-mono text-xs opacity-50">
                              #{loc.id}
                            </td>
                            <td className="px-6 py-4 font-bold">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3 w-3 opacity-50" />{" "}
                                {loc.location_name}{" "}
                                <span className="font-mono text-primary bg-primary/10 px-1 rounded">
                                  {loc.location_no}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs">
                              {loc.label_no ? (
                                <span className="bg-secondary p-1 rounded font-mono mr-2">
                                  {loc.label_no}
                                </span>
                              ) : (
                                "-"
                              )}
                              {loc.specifications}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-bold">
                              {calculateEffectiveStock(
                                loc.id,
                                loc.stock_quantity,
                              )}{" "}
                              / {loc.stock_quantity}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => setReservingItem(loc)}
                                className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded hover:bg-primary hover:text-black transition-colors"
                              >
                                予約
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile: Cards */}
                  <div className="md:hidden divide-y divide-border/50">
                    {group.locations.map((loc) => (
                      <div key={loc.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{loc.id}
                              </span>
                              <div className="font-bold text-sm">
                                {loc.location_name}{" "}
                                <span className="text-primary font-mono ml-1">
                                  [{loc.location_no}]
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-mono text-xs font-black">
                            {calculateEffectiveStock(
                              loc.id,
                              loc.stock_quantity,
                            )}{" "}
                            / {loc.stock_quantity}
                          </div>
                        </div>
                        <button
                          onClick={() => setReservingItem(loc)}
                          className="w-full py-2 bg-primary/10 text-primary text-xs font-bold rounded border border-primary/20"
                        >
                          予約手続きへ
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 予約ダイアログ */}
      {reservingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-2xl p-6 border border-border shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> 在庫の取り置き
              </h3>
              <button onClick={() => setReservingItem(null)}>
                <X className="h-5 w-5 opacity-30" />
              </button>
            </div>
            <div className="text-xs text-muted-foreground p-3 bg-secondary/50 rounded-lg">
              対象:{" "}
              <span className="font-bold text-foreground">
                {reservingItem.item_name}
              </span>
              <br />
              場所: {reservingItem.location_name}
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50">
                  使用予定日
                </label>
                <input
                  type="date"
                  max="9999-12-31"
                  className="w-full bg-secondary/50 p-2.5 rounded-lg outline-none text-sm"
                  value={resDate}
                  onChange={(e) => setResDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold opacity-50">
                  予約数量
                </label>
                <input
                  type="number"
                  min={1}
                  max={calculateEffectiveStock(
                    reservingItem.id,
                    reservingItem.stock_quantity,
                  )}
                  className="w-full bg-secondary/50 p-2.5 rounded-lg outline-none text-sm"
                  value={resQty}
                  onChange={(e) => setResQty(Number(e.target.value))}
                />
              </div>
              <button
                onClick={handleReserve}
                disabled={submitting || !resDate}
                className="w-full bg-primary text-black font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  "予約を確定する"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemsPage;
