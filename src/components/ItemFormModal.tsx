import { useState, useEffect } from 'react';
import { Item } from '@/types';
import { supabase } from '@/lib/supabase'; // 1. インポートを追加
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // 警告対策に追加
} from '@/components/ui/dialog';
import { toast } from 'sonner'; // 保存完了を通知するため

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void; // 引数をなしに変更（中で保存するため）
  item?: Item | null;
}

const ItemFormModal = ({ open, onClose, onSave, item }: ItemFormModalProps) => {
  const [itemName, setItemName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationNo, setLocationNo] = useState('');
  const [stockQuantity, setStockQuantity] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false); // 保存中の状態

  useEffect(() => {
    if (item) {
      setItemName(item.item_name);
      setLocationName(item.location_name);
      setLocationNo(item.location_no);
      setStockQuantity(item.stock_quantity);
    } else {
      setItemName('');
      setLocationName('');
      setLocationNo('');
      setStockQuantity(0);
    }
  }, [item, open]);

  // 2. 保存処理をSupabase向けに書き換え
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const itemData = {
      item_name: itemName,
      location_name: locationName,
      location_no: locationNo,
      stock_quantity: stockQuantity,
    };

    try {
      let error;
      // ここを修正：item が存在し、かつ id がある場合のみ update
      if (item && item.id) {
        const { error: updateError } = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id);
        error = updateError;
      } else {
        // 新規追加
        const { error: insertError } = await supabase
          .from('items')
          .insert([itemData]);
        error = insertError;
      }

      if (error) throw error;

      toast.success(item ? '更新しました' : '追加しました');
      onSave(); 
      onClose();
    } catch (error: any) {
      // エラーログを詳細に出すと原因がもっとわかりやすくなります
      console.error("🔥 DB操作エラー:", error);
      toast.error('エラーが発生しました: ' + (error.message || '不明なエラー'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground font-mono">
            {item ? '物品を編集' : '物品を追加'}
          </DialogTitle>
          {/* 3. 警告対策：説明を追加 */}
          <DialogDescription className="text-muted-foreground text-xs">
            物品の詳細情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">物品名</label>
            <input
              required
              disabled={isSubmitting}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">保管場所</label>
              <input
                required
                disabled={isSubmitting}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">棚番号</label>
              <input
                required
                disabled={isSubmitting}
                value={locationNo}
                onChange={(e) => setLocationNo(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">在庫数</label>
            <input
              required
              disabled={isSubmitting}
              type="number"
              min={0}
              value={stockQuantity}
              onChange={(e) => setStockQuantity(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:bg-secondary/80 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {isSubmitting ? '保存中...' : (item ? '保存' : '追加')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ItemFormModal;