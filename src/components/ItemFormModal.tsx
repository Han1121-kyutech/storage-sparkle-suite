import { useState, useEffect } from "react";
import { Item } from "@/types";
import { supabase } from "@/lib/supabase";
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
  onSave: (item: Item) => void; // 1. 引数を受け取るように戻す
  item?: Item | null;
}

const ItemFormModal = ({ open, onClose, onSave, item }: ItemFormModalProps) => {
  const [itemName, setItemName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationNo, setLocationNo] = useState("");
  const [stockQuantity, setStockQuantity] = useState(0);
  const [memo, setMemo] = useState(""); // 備考も追加
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setItemName(item.item_name);
      setLocationName(item.location_name);
      setLocationNo(item.location_no);
      setStockQuantity(item.stock_quantity);
      setMemo(item.memo || "");
    } else {
      setItemName("");
      setLocationName("");
      setLocationNo("");
      setStockQuantity(0);
      setMemo("");
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const itemData = {
      item_name: itemName.trim(),
      location_name: locationName.trim(),
      location_no: locationNo.trim(),
      stock_quantity: stockQuantity,
      memo: memo.trim(),
    };

    try {
      let resultData: Item | null = null;

      if (item && item.id) {
        // 更新処理：.select().single() を追加して更新後のデータを取得
        const { data, error: updateError } = await supabase
          .from("items")
          .update(itemData)
          .eq("id", item.id)
          .select()
          .single();

        if (updateError) throw updateError;
        resultData = data;
      } else {
        // 新規登録：.select().single() を追加して作成されたデータを取得
        const { data, error: insertError } = await supabase
          .from("items")
          .insert([itemData])
          .select()
          .single();

        if (insertError) throw insertError;
        resultData = data;
      }

      toast.success(item ? "更新しました" : "追加しました");

      // 2. 取得した保存後のデータを AdminPage に渡す
      if (resultData) {
        onSave(resultData);
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
      <DialogContent className="bg-card border-border max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-foreground font-mono">
            {item ? "物品を編集" : "物品を追加"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            物品の詳細情報を入力してください。
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
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
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
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-secondary text-muted-foreground text-sm font-bold hover:bg-secondary/80"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:opacity-90 shadow-sm"
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
