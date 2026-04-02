import { useState } from 'react';
import { mockRequests, mockItems, mockUsers } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { Request } from '@/types';
import { Plus, X } from 'lucide-react';

const statusLabel: Record<Request['status'], string> = {
  pending: '未承認',
  approved: '承認済',
  rejected: '却下',
};

const statusStyle: Record<Request['status'], string> = {
  pending: 'bg-primary/20 text-primary',
  approved: 'bg-success/20 text-success',
  rejected: 'bg-destructive/20 text-destructive',
};

const RequestsPage = () => {
  const { currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState(mockRequests);
  const [selectedItemId, setSelectedItemId] = useState<number>(mockItems[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);

  const userRequests = currentUser?.role === 'admin'
    ? requests
    : requests.filter((r) => r.user_id === currentUser?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const newReq: Request = {
      id: requests.length + 1,
      item_id: selectedItemId,
      user_id: currentUser.id,
      request_quantity: quantity,
      status: 'pending',
    };
    setRequests([newReq, ...requests]);
    setShowForm(false);
    setQuantity(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-mono text-foreground">申請一覧</h2>
          <p className="text-muted-foreground text-sm mt-1">物品の出庫申請を管理</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? '閉じる' : '新規申請'}
        </button>
      </div>

      {/* New request form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-lg bg-card border border-border space-y-4">
          <h3 className="font-semibold text-foreground">新規出庫申請</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">物品</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {mockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name}（在庫: {item.stock_quantity}）
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">数量</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            申請する
          </button>
        </form>
      )}

      {/* Requests table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">物品</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">申請者</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">数量</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {userRequests.map((req) => {
              const item = mockItems.find((i) => i.id === req.item_id);
              const user = mockUsers.find((u) => u.id === req.user_id);
              return (
                <tr key={req.id} className="border-t border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{req.id}</td>
                  <td className="px-4 py-3 text-foreground">{item?.item_name ?? '不明'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user?.user_name ?? '不明'}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">{req.request_quantity}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle[req.status]}`}>
                      {statusLabel[req.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RequestsPage;
