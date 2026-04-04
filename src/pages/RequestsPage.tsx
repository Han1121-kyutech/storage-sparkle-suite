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
  MapPin,
  CheckSquare,
  Square,
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

  // 一括申請用のState
  const [selectedItems, setSelectedItems] = useState<Item[]>([]);
  const [resDate, setResDate] = useState("");
  const [resReturnDate, setResReturnDate] = useState(""); // ✅ ここに正しく配置
  const [resQtyMap, setResQtyMap] = useState<Record<number, number>>({});
  const [resTypeMap, setResTypeMap] = useState<
    Record<number, Request["request_type"]>
  >({});
  const [resMemoMap, setResMemoMap] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [isItemSelectOpen, setIsItemSelectOpen] = useState(false);
  const [itemSelectSearch, setItemSelectSearch] = useState("");

  const fetchData = async () => {
    try {
      const [reqRes, itemRes, userRes] = await Promise.all([
        supabase.from("requests").select("*"),
        supabase
          .from("items")
          .select("*")
          .order("item_name", { ascending: true }),
        supabase.from("users").select("*"),
      ]);
      if (reqRes.error) throw reqRes.error;
      if (itemRes.error) throw itemRes.error;
      if (userRes.error) throw userRes.error;

      setRequests(reqRes.data || []);
      setItems(itemRes.data || []);
      setUsers(userRes.data || []);
    } catch (error: any) {
      toast.error("同期失敗: " + error.message);
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

  const calculateEffectiveStock = (itemId: number, currentStock: number) => {
    const reservedSum = requests
      .filter(
        (r) =>
          r.item_id === itemId &&
          (r.status === "approved" || r.status === "pending"),
      )
      .reduce((sum, r) => sum + r.request_quantity, 0);
    return Math.max(0, currentStock - reservedSum);
  };

  const toggleItemSelection = (item: Item) => {
    const isSelected = selectedItems.some((i) => i.id === item.id);
    if (isSelected) {
      setSelectedItems(selectedItems.filter((i) => i.id !== item.id));
      const newQtyMap = { ...resQtyMap };
      delete newQtyMap[item.id];
      const newTypeMap = { ...resTypeMap };
      delete newTypeMap[item.id];
      const newMemoMap = { ...resMemoMap };
      delete newMemoMap[item.id];
      setResQtyMap(newQtyMap);
      setResTypeMap(newTypeMap);
      setResMemoMap(newMemoMap);
    } else {
      setSelectedItems([...selectedItems, item]);
      setResQtyMap({ ...resQtyMap, [item.id]: 1 });
      setResTypeMap({ ...resTypeMap, [item.id]: "checkout" });
      setResMemoMap({ ...resMemoMap, [item.id]: "" });
    }
  };

  const filteredAndSortedRequests = useMemo(() => {
    const baseRequests = isAdmin
      ? requests
      : requests.filter((r) => String(r.user_id) === String(currentUser?.id));

    const filtered = baseRequests.filter((req) => {
      const item = items.find((i) => i.id === req.item_id);
      const itemName = item?.item_name ?? "";
      const itemLabel = item?.label_no ?? "";
      const itemCategory = item?.category ?? "";
      const userName =
        users.find((u) => String(u.id) === String(req.user_id))?.user_name ??
        "";
      const typeName = typeLabel[req.request_type || "checkout"];
      const searchLower = searchTerm.toLowerCase();

      return (
        itemName.toLowerCase().includes(searchLower) ||
        itemLabel.toLowerCase().includes(searchLower) ||
        itemCategory.toLowerCase().includes(searchLower) ||
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

  const todaysReservations = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const todayStr = `${y}-${m}-${day}`;

    const base = isAdmin
      ? requests
      : requests.filter((r) => String(r.user_id) === String(currentUser?.id));

    return base.filter(
      (r) =>
        r.scheduled_date === todayStr &&
        (r.status === "pending" || r.status === "approved"),
    );
  }, [requests, currentUser, isAdmin]);

  const pendingRequests = filteredAndSortedRequests.filter(
    (r) => r.status === "pending",
  );
  const processedRequests = filteredAndSortedRequests.filter(
    (r) => r.status !== "pending",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (selectedItems.length === 0)
      return toast.error("物品を選択してください");

    const hasCheckout = selectedItems.some(
      (i) => (resTypeMap[i.id] || "checkout") === "checkout",
    );
    if (hasCheckout && !resReturnDate) {
      return toast.error("貸出を含む申請には、返却予定日の入力が必須です");
    }

    for (const item of selectedItems) {
      const eff = calculateEffectiveStock(item.id, item.stock_quantity);
      const qty = resQtyMap[item.id] || 0;
      if (qty <= 0)
        return toast.error(`数量を入力してください: ${item.item_name}`);
      if (qty > eff) return toast.error(`在庫不足: ${item.item_name}`);
      if (resTypeMap[item.id] === "dispose" && !resMemoMap[item.id].trim()) {
        return toast.error(`廃棄理由は必須です: ${item.item_name}`);
      }
    }

    setSubmitting(true);
    try {
      const dateStr = resDate ? resDate.split("-").join("/") : "即時";
      const retDateStr = resReturnDate
        ? resReturnDate.split("-").join("/")
        : "";

      const insertData = selectedItems.map((item) => {
        let finalMemo = resMemoMap[item.id].trim();
        const type = resTypeMap[item.id] || "checkout";

        const dates = [];
        if (resDate) dates.push(`使用:${dateStr}`);
        if (type === "checkout" && resReturnDate)
          dates.push(`返却:${retDateStr}`);

        if (dates.length > 0) {
          finalMemo = `【${dates.join(" / ")}】${finalMemo ? ` ${finalMemo}` : ""}`;
        }

        return {
          item_id: item.id,
          user_id: currentUser.id,
          request_quantity: resQtyMap[item.id],
          request_type: type,
          status: "pending",
          scheduled_date: resDate || null,
          memo: finalMemo,
        };
      });

      const { error } = await supabase.from("requests").insert(insertData);
      if (error) throw error;

      const summary = selectedItems
        .map(
          (i) =>
            `・[${typeLabel[resTypeMap[i.id] || "checkout"]}] ${i.item_name} (x${resQtyMap[i.id]}) [${i.location_name}]`,
        )
        .join("\n");

      await sendRequestNotification(
        `📝 **新規申請 (${selectedItems.length}件)**\n予定日: ${dateStr}\n申請者: ${currentUser.user_name}\n\n【内容】\n${summary}`,
      );

      toast.success("申請完了");
      setShowForm(false);
      setSelectedItems([]);
      setResDate("");
      setResReturnDate("");
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
        `🔄 **返却完了**\n申請者: ${users.find((u) => String(u.id) === String(request.user_id))?.user_name}\n物品: ${item.item_name}\n数量: ${request.request_quantity}\n処理者: ${currentUser?.user_name}`,
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
                物品 / 規格 {getSortIcon("item_name")}
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-0.5">
                        {item?.category && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                            {item.category}
                          </span>
                        )}
                        <div className="font-bold text-foreground">
                          {item?.item_name || "不明"}
                        </div>
                      </div>
                      <div className="text-[10px] flex items-center gap-2 mt-1">
                        {item?.label_no && (
                          <span className="bg-secondary px-1.5 py-0.5 rounded font-mono border border-border/50 text-muted-foreground">
                            {item.label_no}
                          </span>
                        )}
                        <span className="italic text-muted-foreground">
                          {item?.specifications || "-"}
                        </span>
                      </div>
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
                              className="flex items-center gap-1 px-3 py-1.5 bg-info/10 text-info hover:bg-info hover:text-white rounded text-[10px] font-bold transition-all shadow-sm"
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
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item?.category && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20">
                          {item.category}
                        </span>
                      )}
                      <div className="font-bold text-foreground text-sm line-clamp-1">
                        {item?.item_name || "不明"}
                      </div>
                    </div>
                    <div className="text-[10px] flex items-center gap-2 flex-wrap">
                      {item?.label_no && (
                        <span className="bg-secondary px-1.5 py-0.5 rounded font-mono border border-border/50 text-muted-foreground">
                          {item.label_no}
                        </span>
                      )}
                      <span className="italic text-muted-foreground">
                        {item?.specifications || "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
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
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-info/10 text-info hover:bg-info hover:text-white border border-info/20 rounded-lg text-xs font-bold active:scale-[0.98] transition-all shadow-sm mt-2"
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

  const dropdownFilteredItems = useMemo(() => {
    const q = itemSelectSearch.toLowerCase();
    return items.filter(
      (i) =>
        i.item_name.toLowerCase().includes(q) ||
        (i.label_no && i.label_no.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q)) ||
        i.location_name.toLowerCase().includes(q),
    );
  }, [items, itemSelectSearch]);

  return (
    <div className="space-y-6 pb-20 max-w-[1200px] mx-auto relative">
      {/* ★ 本日の予約アラートパネル ★ */}
      {todaysReservations.length > 0 && (
        <div className="bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary rounded-r-xl p-4 sm:p-5 shadow-sm animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start gap-3">
            <div className="bg-primary text-black p-2 rounded-lg shrink-0">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-black text-foreground flex items-center gap-2 uppercase tracking-widest text-sm">
                Today's Reservations
                <span className="bg-primary text-black px-2 py-0.5 rounded-full text-[10px] font-black">
                  {todaysReservations.length}件
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3 font-bold">
                本日使用予定の物品があります。
                {isAdmin
                  ? "貸出準備・承認を行ってください。"
                  : "受け取りを忘れないでください。"}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {todaysReservations.map((req) => {
                  const item = items.find((i) => i.id === req.item_id);
                  const user = users.find(
                    (u) => String(u.id) === String(req.user_id),
                  );
                  return (
                    <div
                      key={req.id}
                      className="bg-card border border-border/50 rounded-xl p-3 flex flex-col shadow-sm hover:border-primary/50 transition-colors gap-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 pr-2 flex-1">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className={`px-1.5 py-0.5 rounded border text-[8px] font-bold shrink-0 ${typeStyle[req.request_type || "checkout"]}`}
                            >
                              {typeLabel[req.request_type || "checkout"]}
                            </span>
                            <div className="text-sm font-black text-foreground truncate">
                              {item?.item_name || "不明な物品"}
                            </div>
                          </div>

                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap leading-tight">
                            {item?.label_no && (
                              <span className="bg-secondary px-1 rounded font-mono border border-border/50 shrink-0">
                                {item.label_no}
                              </span>
                            )}
                            <span className="flex items-center gap-0.5 font-bold truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {item?.location_name}{" "}
                              <span className="text-primary font-mono ml-0.5">
                                #{item?.location_no}
                              </span>
                            </span>
                          </div>

                          {item?.specifications && (
                            <div className="text-[9px] text-muted-foreground italic truncate mt-1 opacity-80">
                              {item.specifications}
                            </div>
                          )}

                          {isAdmin && (
                            <div className="text-[10px] font-bold text-foreground bg-secondary/50 px-2 py-0.5 rounded border border-border/50 inline-flex items-center gap-1 mt-2">
                              <UserIcon className="h-3 w-3 text-primary" />{" "}
                              {user?.user_name}
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1 pl-3 border-l border-border/30 min-w-[50px]">
                          <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">
                            Qty
                          </span>
                          <span className="font-mono font-black text-xl leading-none text-foreground">
                            {req.request_quantity}
                          </span>
                          <span
                            className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded mt-auto ${statusStyle[req.status]}`}
                          >
                            {statusLabel[req.status]}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ★ ここまで ★ */}
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
              placeholder="検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:ring-1 ring-primary focus:outline-none w-full sm:w-64 transition-all shadow-sm"
            />
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) {
                setResReturnDate("");
                setSelectedItems([]);
                setResDate("");
                setResQtyMap({});
                setResTypeMap({});
                setResMemoMap({});
              }
            }}
            className="flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-black text-sm font-bold shadow-sm active:scale-[0.98] transition-all"
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {showForm ? "中止" : "新規申請・予約"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="p-5 sm:p-6 rounded-xl bg-card border border-border shadow-sm space-y-5 animate-in fade-in slide-in-from-top-4 relative">
          <h3 className="font-bold flex items-center gap-2 text-foreground">
            <Plus className="h-4 w-4 text-primary" /> 新規申請・予約の作成
          </h3>

          <div className="space-y-1.5 relative">
            <label className="text-[11px] font-bold uppercase opacity-50">
              対象物品 (複数選択可)
            </label>
            <div
              onClick={() => setIsItemSelectOpen(!isItemSelectOpen)}
              className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-transparent hover:border-primary/50 text-foreground text-sm cursor-pointer flex justify-between items-center shadow-inner transition-colors"
            >
              <span
                className={
                  selectedItems.length > 0
                    ? "font-bold text-primary"
                    : "text-muted-foreground"
                }
              >
                {selectedItems.length > 0
                  ? `${selectedItems.length}件の物品を選択中`
                  : "物品を選択してください..."}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
            </div>

            {isItemSelectOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsItemSelectOpen(false)}
                ></div>
                <div className="absolute z-50 top-full left-0 w-full mt-1 bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 max-h-[50vh]">
                  <div className="p-2 border-b border-border bg-secondary/20">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="物品名・ラベル・カテゴリで検索..."
                        value={itemSelectSearch}
                        onChange={(e) => setItemSelectSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-2 rounded-lg bg-card border border-border text-xs outline-none focus:ring-1 ring-primary"
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto p-1.5 space-y-1">
                    {dropdownFilteredItems.length === 0 ? (
                      <div className="text-center p-4 text-xs text-muted-foreground">
                        見つかりません
                      </div>
                    ) : (
                      dropdownFilteredItems.map((item) => {
                        const eff = calculateEffectiveStock(
                          item.id,
                          item.stock_quantity,
                        );
                        const isDisabled = eff <= 0;
                        const isSelected = selectedItems.some(
                          (i) => i.id === item.id,
                        );
                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isDisabled) return;
                              toggleItemSelection(item);
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isDisabled ? "opacity-50 cursor-not-allowed bg-secondary/10" : "cursor-pointer hover:bg-primary/10"} ${isSelected ? "bg-primary/5 border border-primary/20" : ""}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 pr-3">
                              <div className="shrink-0">
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-primary" />
                                ) : (
                                  <Square className="h-4 w-4 opacity-30" />
                                )}
                              </div>
                              <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {item.category && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
                                      {item.category}
                                    </span>
                                  )}
                                  <span className="font-bold text-sm truncate">
                                    {item.item_name}
                                  </span>
                                  {item.label_no && (
                                    <span className="text-[9px] font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground border shrink-0">
                                      {item.label_no}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                                  <MapPin className="h-3 w-3" />{" "}
                                  {item.location_name} - {item.location_no}{" "}
                                  {item.specifications && (
                                    <span className="ml-1 italic">
                                      | {item.specifications}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black border ${isDisabled ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-success/10 text-success border-success/20"}`}
                              >
                                {isDisabled ? "在庫切" : `残 ${eff}`}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase opacity-50">
              受取 / 使用予定日 (任意)
            </label>
            <input
              type="date"
              value={resDate}
              onChange={(e) => setResDate(e.target.value)}
              min={
                new Date(Date.now() + 9 * 3600000).toISOString().split("T")[0]
              }
              max="9999-12-31"
              className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border-none text-foreground text-sm focus:ring-1 ring-primary outline-none shadow-inner"
            />
          </div>

          {(() => {
            const hasCheckout = selectedItems.some(
              (i) => (resTypeMap[i.id] || "checkout") === "checkout",
            );
            if (!hasCheckout) return null;

            return (
              <div className="space-y-1.5 mt-4">
                <label className="text-[11px] font-bold text-destructive opacity-80 uppercase tracking-widest">
                  返却予定日 (貸出時は必須)
                </label>
                <input
                  type="date"
                  max="9999-12-31"
                  min={
                    resDate ||
                    new Date(Date.now() + 9 * 3600000)
                      .toISOString()
                      .split("T")[0]
                  }
                  className="w-full bg-destructive/5 px-3 py-2.5 rounded-lg outline-none border border-destructive/30 focus:ring-1 ring-destructive font-bold shadow-inner text-sm text-destructive"
                  value={resReturnDate}
                  onChange={(e) => setResReturnDate(e.target.value)}
                />
              </div>
            );
          })()}

          {selectedItems.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <label className="text-[11px] font-bold opacity-50 uppercase tracking-widest">
                個別設定 (数量・種別・備考)
              </label>
              <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-2">
                {selectedItems.map((item) => {
                  const eff = calculateEffectiveStock(
                    item.id,
                    item.stock_quantity,
                  );
                  const currentVal = resQtyMap[item.id];
                  const currentType = resTypeMap[item.id] || "checkout";
                  const currentMemo = resMemoMap[item.id] || "";

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 p-4 bg-secondary/20 rounded-2xl border border-border/50 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4 min-w-0">
                          <div className="text-sm font-black truncate text-foreground">
                            {item.item_name}
                          </div>
                          <div className="text-[9px] opacity-40 uppercase font-bold truncate">
                            {item.label_no || "NO LABEL"} | {item.location_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <input
                            type="number"
                            min={1}
                            max={eff}
                            className="w-16 bg-card border border-border rounded-xl p-2 text-center text-sm font-black focus:ring-1 ring-primary outline-none shadow-sm"
                            value={currentVal === 0 ? "" : currentVal}
                            onChange={(e) =>
                              setResQtyMap({
                                ...resQtyMap,
                                [item.id]:
                                  e.target.value === ""
                                    ? 0
                                    : Number(e.target.value),
                              })
                            }
                            onFocus={(e) => e.target.select()}
                          />
                          <span className="text-[10px] font-black opacity-20">
                            / {eff}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <select
                          className="w-28 bg-card border border-border rounded-xl p-2 text-xs font-bold outline-none focus:ring-1 ring-primary shadow-sm"
                          value={currentType}
                          onChange={(e) =>
                            setResTypeMap({
                              ...resTypeMap,
                              [item.id]: e.target
                                .value as Request["request_type"],
                            })
                          }
                        >
                          <option value="checkout">貸出/予約</option>
                          <option value="consume">消費</option>
                          <option value="dispose">廃棄</option>
                        </select>
                        <input
                          type="text"
                          placeholder={
                            currentType === "dispose"
                              ? "廃棄理由(必須)"
                              : "個別備考..."
                          }
                          className="flex-1 bg-card border border-border rounded-xl p-2 text-xs outline-none focus:ring-1 ring-primary shadow-sm"
                          value={currentMemo}
                          onChange={(e) =>
                            setResMemoMap({
                              ...resMemoMap,
                              [item.id]: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || selectedItems.length === 0}
            className="w-full sm:w-auto px-10 py-3 rounded-lg bg-primary text-black text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all mt-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "一括申請を送信する"
            )}
          </button>
        </div>
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
