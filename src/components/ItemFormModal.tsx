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
import { sendInventoryNotification } from "@/utils/notificationUtils";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (item?: Item) => void;
  item?: Item | null;
  items?: Item[]; // オートフィル用
}

const ItemFormModal = ({
  open,
  onClose,
  onSave,
  item,
  items = [],
}: ItemFormModalProps) => {
  const { currentUser } = useAuth();
  const isRole2 = currentUser?.role === 2;

  const [itemName, setItemName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationNo, setLocationNo] = useState("");
  const [stockQuantity, setStockQuantity] = useState(0);
  const [memo, setMemo] = useState("");
  const [labelNo, setLabelNo] = useState("");
  const [specifications, setSpecifications] = useState("");

  const [alertThreshold, setAlertThreshold] = useState(5);
  const [category, setCategory] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // オートフィル用
  const [autofillSuggestions, setAutofillSuggestions] = useState<Item[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autofillLocationOptions, setAutofillLocationOptions] = useState<
    Item[]
  >([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

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

  // 物品名入力時のサジェスト処理
  const handleItemNameChange = (value: string) => {
    setItemName(value);
    if (value.trim().length === 0) {
      setAutofillSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = value.toLowerCase();
    const matched = items.filter((i) => i.item_name.toLowerCase().includes(q));
    const uniqueNames = Array.from(
      new Map(matched.map((i) => [i.item_name, i])).values(),
    );
    setAutofillSuggestions(uniqueNames);
    setShowSuggestions(uniqueNames.length > 0);
  };

  const handleSelectSuggestion = (selectedName: string) => {
    const matched = items.filter((i) => i.item_name === selectedName);
    setShowSuggestions(false);
    if (matched.length === 1) {
      const i = matched[0];
      setItemName(i.item_name);
      setLabelNo(i.label_no || "");
      setSpecifications(i.specifications || "");
      setLocationName(i.location_name);
      setLocationNo(i.location_no);
    } else {
      setItemName(selectedName);
      setAutofillLocationOptions(matched);
      setShowLocationPicker(true);
    }
  };

  const handleSelectLocation = (i: Item) => {
    setItemName(i.item_name);
    setLabelNo(i.label_no || "");
    setSpecifications(i.specifications || "");
    setLocationName(i.location_name);
    setLocationNo(i.location_no);
    setShowLocationPicker(false);
    setAutofillLocationOptions([]);
  };

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

    if (isRole2) {
      const catTrimmed = category.trim();

      if (catTrimmed.includes(",")) {
        toast.error("カテゴリ名にカンマ(,)は使用できません");
        setIsSubmitting(false);
        return;
      }
      if (catTrimmed.length > 20) {
        toast.error("カテゴリ名は20文字以内にしてください");
        setIsSubmitting(false);
        return;
      }

      itemData.alert_threshold = Math.max(0, alertThreshold);
      itemData.category = catTrimmed || null;
    } else if (!item) {
      // 一般ユーザーの新規作成時のみデフォルト値を設定
      itemData.alert_threshold = 5;
      itemData.category = null;
    }
    // 一般ユーザーの編集時は、itemDataにalert_thresholdとcategoryを含めないことでDB側の上書きを防ぐ

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

      const notifyMsg = item
        ? `📝 **物品編集**\n名前: ${itemData.item_name}\n保管場所: ${itemData.location_name}\n在庫数: ${itemData.stock_quantity}`
        : `✨ **新規物品登録**\n名前: ${itemData.item_name}\n保管場所: ${itemData.location_name}\n初期在庫: ${itemData.stock_quantity}`;

      await sendInventoryNotification(notifyMsg);

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
          <div className="space-y-1.5 relative">
            <label
              htmlFor="itemName"
              className="text-[11px] font-bold uppercase opacity-50"
            >
              物品名
            </label>
            <input
              id="itemName"
              required
              disabled={isSubmitting}
              value={itemName}
              autoComplete="off"
              onChange={(e) => handleItemNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => {
                if (autofillSuggestions.length > 0) setShowSuggestions(true);
              }}
              className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
              placeholder={!item ? "入力でサジェスト表示" : undefined}
            />
            {/* サジェストドロップダウン（新規登録時のみ） */}
            {!item && showSuggestions && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/50 border-b border-border">
                  既存の物品からオートフィル
                </div>
                {autofillSuggestions.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onMouseDown={() => handleSelectSuggestion(i.item_name)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/10 transition-colors flex items-center justify-between gap-2 group"
                  >
                    <span className="font-bold text-sm text-foreground group-hover:text-primary">
                      {i.item_name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {i.location_name}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {/* 複数拠点ピッカー（新規登録時のみ） */}
            {!item && showLocationPicker && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-primary/30 rounded-xl shadow-xl overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/5 border-b border-border flex items-center justify-between">
                  <span>拠点を選択してオートフィル</span>
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                {autofillLocationOptions.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => handleSelectLocation(i)}
                    className="w-full text-left px-3 py-2.5 hover:bg-primary/10 transition-colors flex items-center gap-3 group"
                  >
                    <div>
                      <div className="font-bold text-sm text-foreground group-hover:text-primary">
                        {i.location_name}
                        <span className="font-mono text-primary bg-primary/5 px-1 rounded border border-primary/10 ml-2 text-[10px]">
                          {i.location_no}
                        </span>
                      </div>
                      {i.label_no && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          ラベル: {i.label_no}
                          {i.specifications ? ` / ${i.specifications}` : ""}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="labelNo"
                className="text-[11px] font-bold uppercase opacity-50"
              >
                ラベル番号
              </label>
              <input
                id="labelNo"
                disabled={isSubmitting}
                value={labelNo}
                onChange={(e) => setLabelNo(e.target.value)}
                placeholder="例: DR-01"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="specifications"
                className="text-[11px] font-bold uppercase opacity-50"
              >
                規格 (大きさ・長さ等)
              </label>
              <input
                id="specifications"
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
              <label
                htmlFor="locationName"
                className="text-[11px] font-bold uppercase opacity-50"
              >
                保管場所
              </label>
              <input
                id="locationName"
                required
                disabled={isSubmitting}
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="locationNo"
                className="text-[11px] font-bold uppercase opacity-50"
              >
                棚番号
              </label>
              <input
                id="locationNo"
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
              <label
                htmlFor="stockQuantity"
                className="text-[11px] font-bold uppercase opacity-50"
              >
                在庫数
              </label>
              <input
                id="stockQuantity"
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
              <label
                htmlFor="memo"
                className="text-[11px] font-bold uppercase opacity-50"
              >
                備考
              </label>
              <input
                id="memo"
                disabled={isSubmitting}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm focus:ring-1 ring-primary outline-none"
                placeholder="用途など"
              />
            </div>
          </div>

          {isRole2 && (
            <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 mt-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="alertThreshold"
                  className="text-[11px] font-bold uppercase text-destructive"
                >
                  警告閾値 (Role 2限定)
                </label>
                <input
                  id="alertThreshold"
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
                <label
                  htmlFor="category"
                  className="text-[11px] font-bold uppercase text-primary"
                >
                  カテゴリ上書き (Role 2限定)
                </label>
                <input
                  id="category"
                  disabled={isSubmitting}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-md bg-secondary/50 border border-primary/30 text-foreground text-sm focus:ring-1 ring-primary outline-none"
                  placeholder="例: 消耗品 (カンマ不可)"
                />
                <p className="text-[9px] text-muted-foreground opacity-70">
                  ※入力した文字列で現在のカテゴリを完全上書きします。
                </p>
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
