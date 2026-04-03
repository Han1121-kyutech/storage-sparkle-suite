import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Request, Item, User } from "@/types";
import {
  Plus,
  X,
  Loader2,
  ClipboardCheck,
  User as UserIcon,
  RotateCcw,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Archive,
  AlertCircle,
  FileText,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { sendRequestNotification } from "@/utils/notificationUtils";

const statusLabel: Record<Request["status"], string> = {
  pending: "未承認",
  approved: "承認済",
  rejected: "却下",
  returned: "返却済",
};

const statusStyle: Record<Request["status"], string> = {
  pending: "bg-primary/20 text-primary border-primary/20",
  approved: "bg-success/20 text-success border-success/20",
  rejected: "bg-destructive/20 text-destructive border-destructive/20",
  returned: "bg-info/20 text-info border-info/20",
};

const typeLabel: Record<string, string> = {
  checkout: "貸出",
  consume: "消費",
  dispose: "廃棄",
};

const typeStyle: Record<string, string> = {
  checkout: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  consume: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  dispose: "bg-red-500/10 text-red-500 border-red-500/20",
};

type SortConfig = {
  key: keyof Request | "item_name" | "user_name";
  direction: "asc" | "desc";
};

const RequestsPage = () => {
  const { currentUser } = useAuth();
  const isAdmin = (currentUser?.role ?? 0) >= 1;

  const [showForm, setShowForm] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "id",
    direction: "desc",
  });

  const [isPendingOpen, setIsPendingOpen] = useState(true);
  const [isProcessedOpen, setIsProcessedOpen] = useState(false);

  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [requestType, setRequestType] =
    useState<Request["request_type"]>("checkout");
  const [scheduledDate, setScheduledDate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [reqRes, itemRes, userRes] = await Promise.all([
        supabase.from("requests").select("*"),
        supabase.from("items").select("*").order("id", { ascending: true }),
        supabase.from("users").select("*"),
      ]);
      if (reqRes.error) throw reqRes.error;
      if (itemRes.error) throw itemRes.error;
      if (userRes.error) throw userRes.error;

      setRequests(reqRes.data || []);
      setItems(itemRes.data || []);
      setUsers(userRes.data || []);

      if (itemRes.data?.length > 0 && selectedItemId === 0) {
        setSelectedItemId(itemRes.data[0].id);
      }
    } catch (error: any) {
      toast.error("取得失敗: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSort = (key: SortConfig["key"]) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const filteredAndSortedRequests = useMemo(() => {
    const baseRequests = isAdmin
      ? requests
      : requests.filter((r) => String(r.user_id) === String(currentUser?.id));

    const filtered = baseRequests.filter((req) => {
      const itemName = items.find((i) => i.id === req.item_id)?.item_name ?? "";
      const userName =
        users.find((u) => String(u.id) === String(req.user_id))?.user_name ??
        "";
      const typeName = typeLabel[req.request_type || "checkout"];
      const searchLower = searchTerm.toLowerCase();
      return (
        itemName.toLowerCase().includes(searchLower) ||
        userName.toLowerCase().includes(searchLower) ||
        typeName.toLowerCase().includes(searchLower) ||
        (req.memo && req.memo.toLowerCase().includes(searchLower))
      );
    });

    return [...filtered].sort((a, b) => {
      let aV: any, bV: any;
      if (sortConfig.key === "item_name") {
        aV = items.find((i) => i.id === a.item_id)?.item_name ?? "";
        bV = items.find((i) => i.id === b.item_id)?.item_name ?? "";
      } else if (sortConfig.key === "user_name") {
        aV =
          users.find((u) => String(u.id) === String(a.user_id))?.user_name ??
          "";
        bV =
          users.find((u) => String(u.id) === String(b.user_id))?.user_name ??
          "";
      } else {
        aV = a[sortConfig.key as keyof Request] ?? "";
        bV = b[sortConfig.key as keyof Request] ?? "";
      }
      return sortConfig.direction === "asc"
        ? aV < bV
          ? -1
          : 1
        : aV > bV
          ? -1
          : 1;
    });
  }, [requests, items, users, currentUser, searchTerm, sortConfig, isAdmin]);

  const pendingRequests = filteredAndSortedRequests.filter(
    (r) => r.status === "pending",
  );
  const processedRequests = filteredAndSortedRequests.filter(
    (r) => r.status !== "pending",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const targetItem = items.find((i) => i.id === selectedItemId);

    // 有効在庫（Effective Stock）のチェックを追加
    if (targetItem) {
      const reservedSum = requests
        .filter(
          (r) =>
            r.item_id === targetItem.id &&
            (r.status === "approved" || r.status === "pending"),
        )
        .reduce((sum, r) => sum + r.request_quantity, 0);
      const effectiveStock = Math.max(
        0,
        targetItem.stock_quantity - reservedSum,
      );

      if (quantity > effectiveStock) {
        return toast.error(
          `申請失敗: 他の予約を含めた有効在庫は残り ${effectiveStock} です。`,
        );
      }
    }

    setSubmitting(true);
    try {
      let finalMemo = memo.trim();
      if (scheduledDate) {
        const [y, m, d] = scheduledDate.split("-");
        const dateStr = `${y}年${m}月${d}日`;
        finalMemo = `【予約】使用予定日：${dateStr}${finalMemo ? ` / ${finalMemo}` : ""}`;
      }

      const { error } = await supabase.from("requests").insert([
        {
          item_id: selectedItemId,
          user_id: currentUser.id,
          request_type: requestType,
          request_quantity: quantity,
          memo: finalMemo,
          status: "pending",
          scheduled_date: scheduledDate || null,
        },
      ]);
      if (error) throw error;

      await sendRequestNotification(
        `📝 **新規申請 (${typeLabel[requestType]})**\n申請者: ${currentUser.user_name}\n物品: ${targetItem?.item_name}\n数量: ${quantity}\n使用予定日: ${scheduledDate || "即時"}\n備考: ${finalMemo || "なし"}`,
      );

      toast.success("申請完了");
      setShowForm(false);
      setQuantity(1);
      setMemo("");
      setScheduledDate("");
      setRequestType("checkout");
      fetchData();
    } catch (error: any) {
      toast.error("申請失敗: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async (request: Request) => {
    try {
      const item = items.find((i) => i.id === request.item_id);
      if (!item) throw new Error("物品不明");
      await supabase
        .from("items")
        .update({
          stock_quantity: item.stock_quantity + request.request_quantity,
        })
        .eq("id", item.id);
      await supabase
        .from("requests")
        .update({ status: "returned" })
        .eq("id", request.id);

      await sendRequestNotification(
        `🔄 **返却完了**\n申請者: ${users.find((u) => String(u.id) === String(request.user_id))?.user_name}\n物品: ${item.item_name}\n数量: ${request.request_quantity}`,
      );

      toast.success("返却完了");
      fetchData();
    } catch (error: any) {
      toast.error("返却失敗: " + error.message);
    }
  };

  const getSortIcon = (k: SortConfig["key"]) =>
    sortConfig.key !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-30" />
    ) : sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 text-primary" />
    );

  const renderRequestTable = (reqData: Request[]) => (
    <div>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[1000px]">
          <thead className="bg-secondary/30 text-muted-foreground uppercase text-[11px] font-bold">
            <tr>
              <th
                onClick={() => handleSort("id")}
                className="px-4 py-3 w-16 cursor-pointer hover:text-foreground transition-colors"
              >
                ID {getSortIcon("id")}
              </th>
              <th className="px-4 py-3 w-24">種別</th>
              <th
                onClick={() => handleSort("scheduled_date" as any)}
                className="px-4 py-3 w-32 cursor-pointer hover:text-foreground transition-colors"
              >
                使用予定日 {getSortIcon("scheduled_date" as any)}
              </th>
              <th
                onClick={() => handleSort("item_name")}
                className="px-4 py-3 cursor-pointer hover:text-foreground transition-colors"
              >
                物品 {getSortIcon("item_name")}
              </th>
              <th className="px-4 py-3">申請者</th>
              <th className="px-4 py-3 text-right">数量</th>
              <th className="px-4 py-3">備考</th>
              <th className="px-4 py-3 text-center">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {reqData.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-10 text-muted-foreground italic"
                >
                  該当するデータがありません
                </td>
              </tr>
            ) : (
              reqData.map((req) => {
                const item = items.find((i) => i.id === req.item_id);
                const user = users.find(
                  (u) => String(u.id) === String(req.user_id),
                );
                return (
                  <tr
                    key={req.id}
                    className="hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs opacity-50">
                      #{req.id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded border text-[10px] font-bold ${typeStyle[req.request_type || "checkout"]}`}
                      >
                        {typeLabel[req.request_type || "checkout"]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {req.scheduled_date ? (
                        <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                          <CalendarDays className="h-3.5 w-3.5" />{" "}
                          {req.scheduled_date}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">
                          即時
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">
                      {item?.item_name || "不明"}
                    </td>
                    <td className="px-4 py-3 text-xs flex items-center gap-1">
                      <UserIcon className="h-3 w-3 opacity-50" />{" "}
                      {user?.user_name || "退会"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black">
                      {req.request_quantity}
                    </td>
                    <td className="px-4 py-3 text-xs italic opacity-70">
                      {req.memo || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded border text-[10px] font-black uppercase ${statusStyle[req.status]}`}
                        >
                          {statusLabel[req.status]}
                        </span>
                        {req.status === "approved" &&
                          req.request_type === "checkout" && (
                            <button
                              onClick={() => handleReturn(req)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-info/10 text-info hover:bg-info hover:text-white rounded text-[10px] font-bold transition-all"
                            >
                              <RotateCcw className="h-3 w-3" /> 返却
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-border/50">
        {reqData.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground italic text-sm">
            該当するデータがありません
          </div>
        ) : (
          reqData.map((req) => {
            const item = items.find((i) => i.id === req.item_id);
            const user = users.find(
              (u) => String(u.id) === String(req.user_id),
            );
            return (
              <div
                key={req.id}
                className="p-4 flex flex-col gap-3 bg-card hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{req.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-bold ${typeStyle[req.request_type || "checkout"]}`}
                    >
                      {typeLabel[req.request_type || "checkout"]}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase ${statusStyle[req.status]}`}
                  >
                    {statusLabel[req.status]}
                  </span>
                </div>
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="font-bold text-foreground text-sm line-clamp-1">
                      {item?.item_name || "不明"}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <UserIcon className="h-3 w-3" /> {user?.user_name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">
                      数量
                    </div>
                    <div className="font-mono font-black text-lg text-foreground">
                      {req.request_quantity}
                    </div>
                  </div>
                </div>
                {req.scheduled_date && (
                  <div className="flex items-center gap-2 p-2 bg-primary/5 rounded border border-primary/20 text-primary text-[11px] font-bold">
                    <CalendarDays className="h-3.5 w-3.5" /> 予約日:{" "}
                    {req.scheduled_date}
                  </div>
                )}
                {req.memo && (
                  <div className="flex items-start gap-2 text-[11px] bg-secondary/30 p-2.5 rounded border border-border/50">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 text-muted-foreground leading-relaxed">
                      {req.memo}
                    </div>
                  </div>
                )}
                {req.status === "approved" &&
                  req.request_type === "checkout" && (
                    <button
                      onClick={() => handleReturn(req)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-info/10 text-info hover:bg-info hover:text-white border border-info/20 rounded-lg text-xs font-bold active:scale-[0.98] transition-all shadow-sm"
                    >
                      <RotateCcw className="h-4 w-4" /> 返却手続きをする
                    </button>
                  )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-mono flex items-center gap-2 text-foreground tracking-tighter">
            <ClipboardCheck className="h-6 w-6 text-primary" /> 申請管理
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "全申請を監視中" : "あなたの申請と予約の履歴"}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="名前・物品・理由で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-1 ring-primary focus:outline-none w-full sm:w-64 transition-all"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-black text-sm font-bold shadow-sm active:scale-[0.98] transition-all"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}{" "}
            {showForm ? "中止" : "新規申請・予約"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 rounded-xl bg-card border border-border shadow-sm space-y-5 animate-in fade-in slide-in-from-top-4"
        >
          <h3 className="font-bold flex items-center gap-2 text-foreground">
            <Plus className="h-4 w-4 text-primary" /> 新規申請・予約の作成
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                対象物品
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border-none text-foreground text-sm focus:ring-1 ring-primary outline-none"
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_name} (在庫: {item.stock_quantity})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                申請種別
              </label>
              <select
                value={requestType}
                onChange={(e) =>
                  setRequestType(e.target.value as Request["request_type"])
                }
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border-none text-foreground text-sm focus:ring-1 ring-primary outline-none font-bold"
              >
                <option value="checkout">貸出 / 予約</option>
                <option value="consume">消費 (返却不要)</option>
                <option value="dispose">廃棄 (破損等)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                使用予定日
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                max="9999-12-31"
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border-none text-foreground text-sm focus:ring-1 ring-primary outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase opacity-50">
                数量
              </label>
              <input
                type="number"
                min={1}
                value={quantity || ""}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border-none text-foreground text-sm focus:ring-1 ring-primary outline-none"
                required
              />
            </div>
            <div className="space-y-1.5 md:col-span-2 lg:col-span-2">
              <label className="text-[11px] font-bold uppercase opacity-50">
                備考・用途
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border-none text-foreground text-sm focus:ring-1 ring-primary outline-none"
                placeholder={
                  requestType === "dispose"
                    ? "破損理由を入力"
                    : "例: 実験で使用"
                }
                required={requestType === "dispose"}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || items.length === 0}
            className="w-full sm:w-auto px-10 py-3 rounded-lg bg-primary text-black text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "申請を送信する"
            )}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-20 font-mono opacity-50 animate-pulse text-sm">
          SYNCING DATA...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <button
              onClick={() => setIsPendingOpen(!isPendingOpen)}
              className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-primary">
                <AlertCircle className="h-5 w-5" /> 承認待ち・予約中{" "}
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary text-black text-[10px] font-black">
                  {pendingRequests.length}
                </span>
              </div>
              {isPendingOpen ? (
                <ChevronDown className="h-5 w-5 opacity-50" />
              ) : (
                <ChevronRight className="h-5 w-5 opacity-50" />
              )}
            </button>
            {isPendingOpen && (
              <div className="border-t border-border">
                {renderRequestTable(pendingRequests)}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <button
              onClick={() => setIsProcessedOpen(!isProcessedOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
            >
              <div className="flex items-center gap-2 font-bold text-muted-foreground">
                <Archive className="h-5 w-5" /> 完了した履歴{" "}
                <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary border text-[10px] font-black">
                  {processedRequests.length}
                </span>
              </div>
              {isProcessedOpen ? (
                <ChevronDown className="h-5 w-5 opacity-50" />
              ) : (
                <ChevronRight className="h-5 w-5 opacity-50" />
              )}
            </button>
            {isProcessedOpen && (
              <div className="border-t border-border">
                {renderRequestTable(processedRequests)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestsPage;
