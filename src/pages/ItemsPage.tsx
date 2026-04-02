import { useState } from 'react';
import { mockItems } from '@/data/mockData';
import { Search, MapPin } from 'lucide-react';

const ItemsPage = () => {
  const [search, setSearch] = useState('');

  const filtered = mockItems.filter(
    (item) =>
      item.item_name.includes(search) ||
      item.location_name.includes(search) ||
      item.location_no.includes(search)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">物品一覧</h2>
        <p className="text-muted-foreground text-sm mt-1">倉庫内の全物品を管理</p>
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

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">物品名</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">場所</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">棚番号</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">在庫数</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-t border-border hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3 font-mono text-muted-foreground">{item.id}</td>
                <td className="px-4 py-3 text-foreground font-medium">{item.item_name}</td>
                <td className="px-4 py-3 text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {item.location_name}
                </td>
                <td className="px-4 py-3 font-mono text-primary">{item.location_no}</td>
                <td className={`px-4 py-3 text-right font-mono font-semibold ${
                  item.stock_quantity < 10 ? 'text-destructive' : 'text-foreground'
                }`}>
                  {item.stock_quantity}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center py-8 text-muted-foreground">該当する物品が見つかりません</p>
      )}
    </div>
  );
};

export default ItemsPage;
