import { useState } from 'react';
import { mockItems } from '@/data/mockData';
import { Search, ChevronDown, ChevronRight, MapPin, Package } from 'lucide-react';

const ItemsPage = () => {
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const filtered = mockItems.filter(
    (item) =>
      item.item_name.includes(search) ||
      item.location_name.includes(search) ||
      item.location_no.includes(search)
  );

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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
        {filtered.map((item) => {
          const isOpen = expandedIds.has(item.id);
          return (
            <div key={item.id} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => toggleExpand(item.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-secondary/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{item.item_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {item.stock_quantity < 10 && (
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
                <div className="px-4 py-3 bg-secondary/30 border-t border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">保管場所:</span>
                      <span className="text-foreground font-medium">{item.location_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">棚番号:</span>
                      <span className="font-mono text-primary">{item.location_no}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">在庫数:</span>
                      <span className={`font-mono font-semibold ${item.stock_quantity < 10 ? 'text-destructive' : 'text-foreground'}`}>
                        {item.stock_quantity}
                      </span>
                    </div>
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
