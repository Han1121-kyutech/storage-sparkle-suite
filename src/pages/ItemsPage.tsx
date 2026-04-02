import { useState } from 'react';
import { mockItems } from '@/data/mockData';
import { Search, ChevronDown, ChevronRight, MapPin, Package } from 'lucide-react';

/*重複項目の型定義*/
type GroupedItem = {
  item_name: string;
  locations: typeof mockItems;
  total_stock: number;
};

const ItemsPage = () => {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = mockItems.filter(
    (item) =>
      item.item_name.includes(search) ||
      item.location_name.includes(search) ||
      item.location_no.includes(search)
  );

   /*重複項目*/
  const groupedItems: GroupedItem[] = Object.values(
    filtered.reduce((acc, item) => {
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
    }, {} as Record<string, GroupedItem>)
  );

  const toggleExpand = (item_name: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(item_name) ? next.delete(item_name) : next.add(item_name);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">物品一覧</h2>
        <p className="text-muted-foreground text-sm mt-1">物品名をクリックして詳細を表示</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="物品名・場所で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors"
        />
      </div>

      {/* Accordion list */}
      <div className="space-y-2">
        {groupedItems.map((item) => {
          const isOpen = expandedIds.has(item.item_name);
          return (
            <div key={item.item_name} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => toggleExpand(item.item_name)}
                className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{item.item_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {item.total_stock < 10 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
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
                <div className="px-4 py-3 bg-secondary/30 border-t border-border space-y-3">
                  {item.locations.map((loc) => (
                    <div
                      key={loc.id}
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm py-2 border-b border-border last:border-b-0"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">保管場所:</span>
                        <span className="text-foreground font-medium">{loc.location_name}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">棚番号:</span>
                        <span className="font-mono text-primary">{loc.location_no}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">在庫数:</span>
                        <span
                          className={`font-mono font-semibold ${
                            loc.stock_quantity < 10 ? 'text-destructive' : 'text-foreground'
                          }`}
                        >
                          {loc.stock_quantity}
                        </span>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-2 text-sm">
                    <span className="text-muted-foreground mr-2">合計在庫:</span>
                    <span className="font-mono font-semibold text-foreground">{item.total_stock}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground">該当する物品が見つかりません</p>
      )}
    </div>
  );
};

export default ItemsPage;
