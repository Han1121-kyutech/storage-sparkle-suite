import { useState, useEffect } from 'react'; // useEffectを追加
import { supabase } from '@/lib/supabase'; // supabaseをインポート
import { mockRequests, mockUsers } from '@/data/mockData';
import { Request, Item } from '@/types';
import { CheckCircle, XCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import ItemFormModal from '@/components/ItemFormModal';
import DeleteConfirmDialog from '@/components/DeleteConfirmDialog';
import { toast } from 'sonner';

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
  const [items, setItems] = useState<Item[]>([]); // 初期値は空にする
  const [loading, setLoading] = useState(true);

  // --- DBからデータを取得する関数 ---
  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('id', { ascending: true }); // ID順に並べる

      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast.error('データ取得失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ページ読み込み時に実行
  useEffect(() => {
    fetchItems();
  }, []);

  // Item CRUD state
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

// AdminPage.tsx の中に追記・修正するイメージ

// 1. 申請データを取得する関数を追加
const fetchRequests = async () => {
  const { data, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false }); // 新しい順

  if (!error) setRequests(data || []);
};

// 2. useEffectでアイテムと一緒に申請も呼ぶ
useEffect(() => {
  fetchItems();
  fetchRequests();
}, []);

// 3. 承認・却下ボタンの処理をSupabase向けに書き換え
const updateStatus = async (id: number, status: Request['status']) => {
  try {
    const { error } = await supabase
      .from('requests')
      .update({ status: status })
      .eq('id', id);

    if (error) throw error;
    
    toast.success(`ステータスを${statusLabel[status]}に更新しました`);
    fetchRequests(); // リストを再読み込み
  } catch (error: any) {
    toast.error('更新失敗: ' + error.message);
  }
};
  // --- 保存が終わった後に呼ばれる関数 ---
  const handleSaveItem = () => {
    fetchItems(); // Supabaseから最新データを取ってきてリストを更新する
    setFormOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', deleteTarget.id);
      
      if (error) throw error;
      
      toast.success('削除しました');
      fetchItems(); // リスト更新
    } catch (error: any) {
      toast.error('削除失敗: ' + error.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const pendingFirst = [...requests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  if (loading) return <div className="p-8 text-center font-mono">LOADING DATABASE...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold font-mono text-foreground">管理者パネル</h2>
        <p className="text-muted-foreground text-sm mt-1">物品管理と申請の承認・却下</p>
      </div>

      {/* ── Item management ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">物品管理 (Supabase)</h3>
          <button
            onClick={() => { setEditingItem(null); setFormOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            追加
          </button>
        </div>

        {/* テーブル部分はそのまま（itemsの中身がSupabaseのものに入れ替わります） */}
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
              {items.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">データがありません。</td></tr>
              ) : (
                items.map((item) => (
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
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 申請管理テーブルは一旦モックのままですが、後で同様にSupabase化できます */}
      {/* ... (略) ... */}

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