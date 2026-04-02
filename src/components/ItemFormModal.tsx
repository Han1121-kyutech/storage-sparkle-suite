import { useState, useEffect } from 'react';
import { Item } from '@/types';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Omit<Item, 'id'> & { id?: number }) => void;
  item?: Item | null;
}

const ItemFormModal = ({ open, onClose, onSave, item }: ItemFormModalProps) => {
  const [itemName, setItemName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationNo, setLocationNo] = useState('');
  const [stockQuantity, setStockQuantity] = useState(0);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(item ? { id: item.id } : {}),
      item_name: itemName,
      location_name: locationName,
      location_no: locationNo,
      stock_quantity: stockQuantity,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground font-mono">
            {item ? '物品を編集' : '物品を追加'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">物品名</label>
            <input
              required
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
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">棚番号</label>
              <input
                required
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
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:bg-secondary/80 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {item ? '保存' : '追加'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ItemFormModal;
