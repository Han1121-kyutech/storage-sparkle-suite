import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Item } from "@/types";
import {
  Search,
  ChevronDown,
  ChevronRight,
  MapPin,
  Package,
  FileText,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

type GroupedItem = {
  item_name: string;
  locations: Item[];
  total_stock: number;
};

const ItemsPage = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [newItem, setNewItem] = useState({
    item_name: "",
    location_name: "",
    location_no: "",
    stock_quantity: 0,
    memo: "",
  });

  const fetchItems = async () => {
    const { data, error } = await supabase.from("items").select("*");
    if (error) {
      toast.error("データの取得に失敗しました: " + error.message);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { error } = await supabase.from("items").insert([
        {
          item_name: newItem.item_name.trim(),
          location_name: newItem.location_name.trim(),
          location_no: newItem.location_no.trim(),
          stock_quantity: Number(newItem.stock_quantity),
          memo: newItem.memo.trim(),
        },
      ]);

      if (error) throw error;

      toast.success("物品を追加しました");
      setNewItem({
        item_name: "",
        location_name: "",
        location_no: "",
        stock_quantity: 0,
        memo: "",
      });
      fetchItems();
    } catch (error: any) {
      toast.error("追加失敗: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = items.filter(
    (item) =>
      item.item_name.includes(search) ||
      item.location_name.includes(search) ||
      item.location_no.includes(search) ||
      (item.memo && item.memo.includes(search)),
  );

  const groupedItems: GroupedItem[] = Object.values(
    filtered.reduce(
      (acc, item) => {
        if (!acc[item.item_name]) {
          acc[item.item_name] = {
            item_name: item.item_name,
            locations: [],
            total_stock: 0,
          };
        }
        acc[item.item_name].locations.push(item);
        acc[item.item_name].total_stock += item.stock_quantity;
        return acc;
      },
      {} as Record<string, GroupedItem>,
    ),
  );

  const toggleExpand = (item_name: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(item_name) ? next.delete(item_name) : next.add(item_name);
      return next;
    });
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground tracking-tighter">
          物品管理
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          物品の登録と一覧確認ができます
        </p>
      </div>

      {/* 物品追加フォーム */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" /> 新規物品登録
        </h3>
        <form
          onSubmit={handleAddItem}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase opacity-50">
              物品名
            </label>
            <input
              type="text"
              required
              value={newItem.item_name}
              onChange={(e) =>
                setNewItem({ ...newItem, item_name: e.target.value })
              }
              className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-1 ring-primary outline-none transition-all"
              placeholder="例: マスキングテープ"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase opacity-50">
              保管場所
            </label>
            <input
              type="text"
              required
              value={newItem.location_name}
              onChange={(e) =>
                setNewItem({ ...newItem, location_name: e.target.value })
              }
              className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-1 ring-primary outline-none transition-all"
              placeholder="例: 第1倉庫"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase opacity-50">
              棚番号
            </label>
            <input
              type="text"
              required
              value={newItem.location_no}
              onChange={(e) =>
                setNewItem({ ...newItem, location_no: e.target.value })
              }
              className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-1 ring-primary outline-none transition-all"
              placeholder="例: A-1"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase opacity-50">
              在庫数
            </label>
            <input
              type="number"
              required
              min="0"
              /* 「012」問題を解消：値が0のときは空文字にして、入力時に0が残らないようにする */
              value={newItem.stock_quantity === 0 ? "" : newItem.stock_quantity}
              onChange={(e) =>
                setNewItem({
                  ...newItem,
                  stock_quantity:
                    e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
              /* フォーカス時に中身を全選択させて上書きしやすくする */
              onFocus={(e) => e.target.select()}
              className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-1 ring-primary outline-none transition-all"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-bold uppercase opacity-50">
              備考・用途（メモ）
            </label>
            <input
              type="text"
              value={newItem.memo}
              onChange={(e) => setNewItem({ ...newItem, memo: e.target.value })}
              className="w-full bg-secondary/50 border-none rounded-md px-3 py-2 text-sm focus:ring-1 ring-primary outline-none transition-all"
              placeholder="用途や特記事項を入力"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground font-bold py-2 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              追加する
            </button>
          </div>
        </form>
      </div>

      <hr className="border-border" />

      {/* 検索バー */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="物品名・場所・メモで検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      {/* 物品一覧 */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-10 opacity-50 animate-pulse font-mono text-xs">
            LOADING DATABASE...
          </div>
        ) : (
          groupedItems.map((item) => {
            const isOpen = expandedIds.has(item.item_name);
            return (
              <div
                key={item.item_name}
                className="rounded-lg border border-border overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => toggleExpand(item.item_name)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-secondary/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-primary" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      <span className="text-sm font-bold text-foreground">
                        {item.item_name}
                      </span>
                      {/* 各物品の総在庫を小さく表示 */}
                      <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border/50 font-mono">
                        計: {item.total_stock}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.total_stock < 10 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-bold border border-destructive/20">
                        在庫少
                      </span>
                    )}
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 py-3 bg-secondary/20 border-t border-border space-y-3">
                    {item.locations.map((loc) => (
                      <div
                        key={loc.id}
                        className="py-3 border-b border-border/50 last:border-b-0 space-y-2"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[13px]">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">場所:</span>
                            <span className="text-foreground font-medium">
                              {loc.location_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">棚番:</span>
                            <span className="font-mono text-primary font-bold">
                              {loc.location_no}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">在庫:</span>
                            <span
                              className={`font-mono font-bold ${loc.stock_quantity < 10 ? "text-destructive" : "text-foreground"}`}
                            >
                              {loc.stock_quantity}
                            </span>
                          </div>
                        </div>
                        {loc.memo && (
                          <div className="flex items-start gap-2 text-[11px] bg-card/40 p-2 rounded border border-border/40">
                            <FileText className="h-3 w-3 text-muted-foreground mt-0.5" />
                            <div className="flex-1 text-foreground leading-relaxed">
                              <span className="text-muted-foreground font-bold mr-1">
                                備考:
                              </span>
                              {loc.memo}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ItemsPage;
