import { mockItems, mockRequests } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { Package, ClipboardList, AlertTriangle, CheckCircle } from 'lucide-react';

const DashboardPage = () => {
  const { currentUser } = useAuth();
  const lowStockItems = mockItems.filter((i) => i.stock_quantity < 10);
  const pendingRequests = mockRequests.filter((r) => r.status === 'pending');
  const approvedRequests = mockRequests.filter((r) => r.status === 'approved');

  const stats = [
    { label: '物品数', value: mockItems.length, icon: Package, color: 'text-info' },
    { label: '未承認申請', value: pendingRequests.length, icon: ClipboardList, color: 'text-primary' },
    { label: '在庫少', value: lowStockItems.length, icon: AlertTriangle, color: 'text-destructive' },
    { label: '承認済み', value: approvedRequests.length, icon: CheckCircle, color: 'text-success' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">ダッシュボード</h2>
        <p className="text-muted-foreground text-sm mt-1">
          ようこそ、{currentUser?.user_name}さん
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="p-5 rounded-lg bg-card border border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <p className="text-3xl font-bold font-mono mt-2 text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            在庫が少ない物品
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">物品名</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">場所</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">在庫数</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 text-foreground">{item.item_name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{item.location_no}</td>
                    <td className="px-4 py-3 text-right font-mono text-destructive font-semibold">
                      {item.stock_quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
