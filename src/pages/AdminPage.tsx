import { useState } from 'react';
import { mockRequests, mockItems as initialItems, mockUsers } from '@/data/mockData';
import { Request, Item } from '@/types';
import { CheckCircle, XCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import ItemFormModal from '@/components/ItemFormModal';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';

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
  const [items, setItems] = useState<Item[]>(initialItems);

  // Item CRUD state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

  const updateStatus = (id: number, status: Request['status']) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  };

  const handleSaveItem = (data: Omit<Item, 'id'> & { id?: number }) => {
    if (data.id != null) {
      // edit
      setItems((prev) => prev.map((i) => (i.id === data.id ? { ...i, ...data } as Item : i)));
    } else {
      // add
      const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
      setItems((prev) => [...prev, { ...data, id: newId } as Item]);
    }
  };

  const handleDeleteItem = () => {
    if (!deleteTarget) return;
    setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const pendingFirst = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">管理者パネル</h2>
        <p className="text-muted-foreground text-sm mt-1">物品管理と申請の承認・却下</p>
      </div>

      {/* ── Item management ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">物品管理</h3>
          <button
            onClick={() => { setEditingItem(null); setFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            追加
          </button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">物品名</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">場所</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">棚番号</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">在庫数</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-secondary/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{item.id}</td>
                  <td className="px-4 py-3 text-foreground font-medium">{item.item_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.location_name}</td>
                  <td className="px-4 py-3 font-mono text-primary">{item.location_no}</td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${item.stock_quantity < 10 ? 'text-destructive' : 'text-foreground'}`}>
                    {item.stock_quantity}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => { setEditingItem(item); setFormOpen(true); }}
                        className="p-1.5 rounded-md bg-info/20 text-info hover:bg-info/30 transition-colors"
                        title="編集"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Request management ── */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">申請管理</h3>
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
                const item = items.find((i) => i.id === req.item_id);
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

      {/* Modals */}
      <ItemFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingItem(null); }}
        onSave={handleSaveItem}
        item={editingItem}
      />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteItem}
        itemName={deleteTarget?.item_name ?? ''}
      />
    </div>
  );
};

export default AdminPage;
