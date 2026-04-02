import { useState } from 'react';
import { mockRequests, mockItems, mockUsers } from '@/data/mockData';
import { Request } from '@/types';
import { CheckCircle, XCircle } from 'lucide-react';

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

const AdminPage = () => {
  const [requests, setRequests] = useState(mockRequests);

  const updateStatus = (id: number, status: Request['status']) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  const pendingFirst = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">管理者パネル</h2>
        <p className="text-muted-foreground text-sm mt-1">申請の承認・却下を行います</p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">物品</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">申請者</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">数量</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">ステータス</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            {pendingFirst.map((req) => {
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
                  <td className="px-4 py-3 text-center">
                    {req.status === 'pending' ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => updateStatus(req.id, 'approved')}
                          className="p-1.5 rounded-md bg-success/20 text-success hover:bg-success/30 transition-colors"
                          title="承認"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(req.id, 'rejected')}
                          className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                          title="却下"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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

export default AdminPage;
