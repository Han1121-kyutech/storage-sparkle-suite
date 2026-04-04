import { useState, useEffect } from "react";
import { Item } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (item?: Item) => void;
  item?: Item | null;
}

const ItemFormModal = ({ open, onClose, onSave, item }: ItemFormModalProps) => {
  const { currentUser } = useAuth();
  const isRole2 = currentUser?.role === 2;

  const [itemName, setItemName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationNo, setLocationNo] = useState("");
  const [stockQuantity, setStockQuantity] = useState(0);
  const [memo, setMemo] = useState("");
  const [labelNo, setLabelNo] = useState("");
  const [specifications, setSpecifications] = useState("");

  // 権力者（Role 2）専用State
  const [alertThreshold, setAlertThreshold] = useState(5);
  const [category, setCategory] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setItemName(item.item_name || "");
      setLocationName(item.location_name || "");
      setLocationNo(item.location_no || "");
      setStockQuantity(item.stock_quantity || 0);
      setMemo(item.memo || "");
      setLabelNo(item.label_no || "");
      setSpecifications(item.specifications || "");
      setAlertThreshold(item.alert_threshold ?? 5);
      setCategory(item.category || "");
    } else {
      setItemName("");
      setLocationName("");
      setLocationNo("");
      setStockQuantity(0);
      setMemo("");
      setLabelNo("");
      setSpecifications("");
      setAlertThreshold(5);
      setCategory("");
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const itemData: Partial<Item> = {
      item_name: itemName.trim(),
      location_name: locationName.trim(),
      location_no: locationNo.trim(),
      stock_quantity: stockQuantity,
      memo: memo.trim(),
      label_no: labelNo.trim(),
      specifications: specifications.trim(),
    };

    // Role 2のみが閾値とカテゴリを操作可能。非Role 2の新規登録時はデフォルト値を利用
    if (isRole2) {
      itemData.alert_threshold = alertThreshold;
      itemData.category = category.trim() || null;
    } else if (!item) {
      itemData.alert_threshold = 5;
      itemData.category = null;
    }

    try {
      let resultData: Item | null = null;

      if (item && item.id) {
        const { data, error: updateError } = await supabase
          .from("items")
          .update(itemData)
          .eq("id", item.id)
          .select()
          .single();

        if (updateError) throw updateError;
        resultData = data;
      } else {
        const { data, error: insertError } = await supabase
          .from("items")
          .insert([itemData])
          .select()
          .single();

        if (insertError) throw insertError;
        resultData = data;
      }

      toast.success(item ? "更新しました" : "追加しました");

      if (resultData) {
        onSave(resultData);
      } else {
        onSave();
      }
      onClose();
    } catch (error: any) {
      console.error("🔥 DB操作エラー:", error);
      toast.error("エラーが発生しました: " + (error.message || "不明なエラー"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border-border max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-mono">
            {item ? "物品を編集" : "物品を追加"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            物品の詳細情報を入力してください。ラベルがない場合は空欄で構いません。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase opacity-50">
              物品名
            </label>
            <input
              required
              disabled={isSubmitting}
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                ラベル番号
              </label>
              <input
                disabled={isSubmitting}
                value={labelNo}
                onChange={(e) => setLabelNo(e.target.value)}
                placeholder="例: DR-01"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                規格 (大きさ・長さ等)
              </label>
              <input
                disabled={isSubmitting}
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                placeholder="例: 30m / 5.4×7.2m"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                保管場所
              </label>
              <input
                required
                disabled={isSubmitting}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                棚番号
              </label>
              <input
                required
                disabled={isSubmitting}
                value={locationNo}
                onChange={(e) => setLocationNo(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                在庫数
              </label>
              <input
                required
                disabled={isSubmitting}
                type="number"
                min={0}
                value={stockQuantity}
                onChange={(e) => setStockQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                備考
              </label>
              <input
                disabled={isSubmitting}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
                placeholder="用途など"
              />
            </div>
          </div>

          {/* Role 2専用 特権フィールド */}
          {isRole2 && (
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-destructive">
                  警告閾値 (Role 2限定)
                </label>
                <input
                  type="number"
                  min={0}
                  disabled={isSubmitting}
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-md bg-secondary/50 border border-destructive/30 text-foreground text-sm focus:ring-1 ring-destructive outline-none font-mono"
                  placeholder="デフォルト: 5"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase text-primary">
                  カテゴリ (Role 2限定)
                </label>
                <input
                  disabled={isSubmitting}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-secondary/50 border border-primary/30 text-foreground text-sm focus:ring-1 ring-primary outline-none"
                  placeholder="例: 消耗品"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-bold hover:bg-secondary/80 transition-all"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:opacity-90 shadow-sm active:scale-95 transition-all"
            >
              {isSubmitting ? "保存中..." : item ? "更新する" : "追加する"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ItemFormModal;
