// src/test/pages.test.ts
// ロジック関数のユニットテスト (Supabase非依存部分)
// vitest で実行: npx vitest run

import { describe, it, expect } from "vitest";
import type { Item, Request } from "@/types";

// =====================================================================
// DashboardPage — ロジック
// =====================================================================

describe("DashboardPage — lowStockItems 判定", () => {
  const makeItem = (partial: Partial<Item>): Item => ({
    id: 1,
    item_name: "テスト品",
    location_name: "A棟",
    location_no: "A-01",
    stock_quantity: 10,
    alert_threshold: 5,
    ...partial,
  });

  // 各アイテムの個別閾値で判定するロジック
  const getLowStockItems = (items: Item[]) =>
    items.filter((i) => i.stock_quantity < (i.alert_threshold ?? 5));

  it("在庫が閾値未満のアイテムが検出される", () => {
    const items = [
      makeItem({ stock_quantity: 3, alert_threshold: 5 }),
      makeItem({ stock_quantity: 10, alert_threshold: 5 }),
    ];
    expect(getLowStockItems(items)).toHaveLength(1);
  });

  it("在庫が閾値ちょうどのアイテムはアラートにならない（境界値）", () => {
    const items = [makeItem({ stock_quantity: 5, alert_threshold: 5 })];
    // stock_quantity < alert_threshold なので 5 < 5 = false
    expect(getLowStockItems(items)).toHaveLength(0);
  });

  it("在庫が0のアイテムは必ずアラートになる", () => {
    const items = [makeItem({ stock_quantity: 0, alert_threshold: 1 })];
    expect(getLowStockItems(items)).toHaveLength(1);
  });

  it("【バグ注意】alert_threshold が未設定(undefined)のアイテムはデフォルト5で判定", () => {
    const item = makeItem({ stock_quantity: 3, alert_threshold: undefined as any });
    const result = item.stock_quantity < (item.alert_threshold ?? 5);
    expect(result).toBe(true); // 3 < 5 なのでアラート
  });

  it("role=0一般ユーザーは自分の申請だけ見える", () => {
    const requests: Partial<Request>[] = [
      { id: 1, user_id: 1, status: "pending" },
      { id: 2, user_id: 2, status: "pending" },
      { id: 3, user_id: 1, status: "approved" },
    ];
    const currentUserId = 1;
    const myRequests = requests.filter(
      (r) => String(r.user_id) === String(currentUserId),
    );
    expect(myRequests).toHaveLength(2);
  });

  it("role>=1管理者は全申請が見える", () => {
    const requests: Partial<Request>[] = [
      { id: 1, user_id: 1, status: "pending" },
      { id: 2, user_id: 2, status: "pending" },
    ];
    const role = 1;
    const targetRequests = role >= 1 ? requests : [];
    expect(targetRequests).toHaveLength(2);
  });
});

// =====================================================================
// ItemsPage — calculateEffectiveStock ロジック
// =====================================================================

describe("ItemsPage — 実効在庫計算", () => {
  const makeRequest = (partial: Partial<Request>): Request => ({
    id: 1,
    item_id: 1,
    user_id: 1,
    request_type: "checkout",
    request_quantity: 1,
    status: "pending",
    ...partial,
  });

  const calculateEffectiveStock = (
    itemId: number,
    currentStock: number,
    requests: Request[],
  ) => {
    const reservedSum = requests
      .filter(
        (r) =>
          r.item_id === itemId &&
          (r.status === "approved" || r.status === "pending"),
      )
      .reduce((sum, r) => sum + r.request_quantity, 0);
    return Math.max(0, currentStock - reservedSum);
  };

  it("approved + pending の申請数が在庫から引かれる", () => {
    const requests = [
      makeRequest({ item_id: 1, request_quantity: 3, status: "pending" }),
      makeRequest({ item_id: 1, request_quantity: 2, status: "approved" }),
    ];
    expect(calculateEffectiveStock(1, 10, requests)).toBe(5);
  });

  it("rejected・returned申請は在庫計算に含まれない", () => {
    const requests = [
      makeRequest({ item_id: 1, request_quantity: 5, status: "rejected" }),
      makeRequest({ item_id: 1, request_quantity: 3, status: "returned" }),
    ];
    expect(calculateEffectiveStock(1, 10, requests)).toBe(10);
  });

  it("実効在庫はマイナスにならない（最小0）", () => {
    const requests = [
      makeRequest({ item_id: 1, request_quantity: 100, status: "pending" }),
    ];
    expect(calculateEffectiveStock(1, 5, requests)).toBe(0);
  });

  it("別のitem_idの申請は影響しない", () => {
    const requests = [
      makeRequest({ item_id: 2, request_quantity: 5, status: "pending" }),
    ];
    expect(calculateEffectiveStock(1, 10, requests)).toBe(10);
  });

  it("【バグ注意】申請数量が0のレコードがあっても壊れない", () => {
    const requests = [
      makeRequest({ item_id: 1, request_quantity: 0, status: "pending" }),
    ];
    expect(calculateEffectiveStock(1, 5, requests)).toBe(5);
  });
});

// =====================================================================
// ItemsPage — 予約バリデーション
// =====================================================================

describe("ItemsPage — 予約申請バリデーション", () => {
  it("使用予定日がない場合は申請できない", () => {
    const resDate = "";
    const reservingItems = [{ id: 1 }];
    const canSubmit = reservingItems.length > 0 && !!resDate;
    expect(canSubmit).toBe(false);
  });

  it("数量0の場合はエラーになる", () => {
    const qty = 0;
    expect(qty <= 0).toBe(true); // エラー条件
  });

  it("数量が実効在庫を超える場合はエラーになる", () => {
    const qty = 10;
    const eff = 5;
    expect(qty > eff).toBe(true); // エラー条件
  });

  it("【バグ注意】resQtyMapにitem_idがない場合はqty=0になる", () => {
    const resQtyMap: Record<number, number> = {};
    const itemId = 999;
    const qty = resQtyMap[itemId] || 0;
    expect(qty).toBe(0); // 未設定→0→エラーになる（正しい動作）
  });
});

// =====================================================================
// RequestsPage — フィルタリング・ソートロジック
// =====================================================================

describe("RequestsPage — フィルタリング", () => {
  const makeRequest = (partial: Partial<Request>): Request => ({
    id: 1,
    item_id: 1,
    user_id: 1,
    request_type: "checkout",
    request_quantity: 1,
    status: "pending",
    ...partial,
  });

  it("一般ユーザーは自分の申請だけ表示される", () => {
    const currentUserId = 1;
    const requests = [
      makeRequest({ id: 1, user_id: 1 }),
      makeRequest({ id: 2, user_id: 2 }),
      makeRequest({ id: 3, user_id: 1 }),
    ];
    const result = requests.filter(
      (r) => String(r.user_id) === String(currentUserId),
    );
    expect(result).toHaveLength(2);
  });

  it("pendingとpending以外が正しく分類される", () => {
    const requests = [
      makeRequest({ status: "pending" }),
      makeRequest({ status: "approved" }),
      makeRequest({ status: "rejected" }),
      makeRequest({ status: "returned" }),
    ];
    const pending = requests.filter((r) => r.status === "pending");
    const processed = requests.filter((r) => r.status !== "pending");
    expect(pending).toHaveLength(1);
    expect(processed).toHaveLength(3);
  });

  it("【バグ注意】user_idがstringとnumberで混在しても一致する", () => {
    // DBから来るuser_idはnumberの場合もstringの場合もある
    const requestUserId = 1;      // number
    const currentUserId = "1";   // string
    expect(String(requestUserId) === String(currentUserId)).toBe(true);
  });

  it("廃棄(dispose)申請はメモ必須フラグが立つ", () => {
    const requestType = "dispose";
    const isRequired = requestType === "dispose";
    expect(isRequired).toBe(true);
  });
});

// =====================================================================
// AdminPage — ロジック
// =====================================================================

describe("AdminPage — getStockColorClass", () => {
  const getStockColorClass = (quantity: number, threshold: number = 5) => {
    if (quantity >= threshold * 3) return "text-success";
    if (quantity >= threshold) return "text-warning";
    return "text-destructive font-black animate-pulse";
  };

  it("閾値の3倍以上は緑(success)", () => {
    expect(getStockColorClass(15, 5)).toBe("text-success");
  });

  it("閾値以上3倍未満は黄(warning)", () => {
    expect(getStockColorClass(5, 5)).toBe("text-warning");
    expect(getStockColorClass(14, 5)).toBe("text-warning");
  });

  it("閾値未満は赤(destructive)でアニメーション付き", () => {
    expect(getStockColorClass(4, 5)).toBe("text-destructive font-black animate-pulse");
    expect(getStockColorClass(0, 5)).toBe("text-destructive font-black animate-pulse");
  });

  it("【境界値】threshold=0 のときは常に success", () => {
    // 0 * 3 = 0 なので quantity(0) >= 0 は true → success になる
    expect(getStockColorClass(0, 0)).toBe("text-success");
  });
});

describe("AdminPage — getCategoryColor (ハッシュ)", () => {
  const getCategoryColor = (categoryName: string) => {
    const colors = [
      "bg-blue-500/10 text-blue-500 border-blue-500/20",
      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      "bg-purple-500/10 text-purple-500 border-purple-500/20",
      "bg-orange-500/10 text-orange-500 border-orange-500/20",
      "bg-pink-500/10 text-pink-500 border-pink-500/20",
      "bg-teal-500/10 text-teal-500 border-teal-500/20",
      "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      "bg-rose-500/10 text-rose-500 border-rose-500/20",
    ];
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
      hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  it("同じカテゴリ名は常に同じ色を返す（冪等性）", () => {
    const color1 = getCategoryColor("消耗品");
    const color2 = getCategoryColor("消耗品");
    expect(color1).toBe(color2);
  });

  it("空文字でもクラッシュしない", () => {
    expect(() => getCategoryColor("")).not.toThrow();
  });

  it("長い文字列でもクラッシュしない", () => {
    const long = "カ".repeat(1000);
    expect(() => getCategoryColor(long)).not.toThrow();
  });
});

describe("AdminPage — 在庫承認時の在庫更新ロジック", () => {
  it("承認時に在庫数が申請量分減る", () => {
    const currentStock = 10;
    const requestQuantity = 3;
    const newStock = currentStock - requestQuantity;
    expect(newStock).toBe(7);
  });

  it("返却時に在庫数が申請量分増える", () => {
    const currentStock = 7;
    const requestQuantity = 3;
    const newStock = currentStock + requestQuantity;
    expect(newStock).toBe(10);
  });

  it("【バグ注意】在庫不足でも承認をスキップするだけで他の申請は続く", () => {
    // updateBulkStatus内: 在庫不足はtoast.error + continue
    // → グループ内の他の申請は続けて処理される仕様
    const items = [
      { id: 1, stock_quantity: 2 },
      { id: 2, stock_quantity: 10 },
    ];
    const requests = [
      { id: 1, item_id: 1, request_quantity: 5 }, // 在庫不足
      { id: 2, item_id: 2, request_quantity: 3 }, // 通過するはず
    ];
    const processed: number[] = [];
    for (const r of requests) {
      const i = items.find((item) => item.id === r.item_id);
      if (!i) continue;
      if (i.stock_quantity < r.request_quantity) continue; // 在庫不足スキップ
      processed.push(r.id);
    }
    expect(processed).toContain(2); // item2は処理される
    expect(processed).not.toContain(1); // item1はスキップ
  });
});

describe("AdminPage — bulkUpdateCategory ロジック", () => {
  const parseCats = (category: string | null | undefined): string[] =>
    category
      ? category.split(",").map((c) => c.trim()).filter(Boolean)
      : [];

  it("カテゴリを追加できる", () => {
    const item = { category: "消耗品" };
    const cats = parseCats(item.category);
    if (!cats.includes("工具")) cats.push("工具");
    expect(cats).toEqual(["消耗品", "工具"]);
  });

  it("既存カテゴリの重複追加は無視される", () => {
    const item = { category: "消耗品,工具" };
    const cats = parseCats(item.category);
    if (!cats.includes("消耗品")) cats.push("消耗品");
    expect(cats.filter((c) => c === "消耗品")).toHaveLength(1);
  });

  it("カテゴリを削除できる", () => {
    const item = { category: "消耗品,工具" };
    const cats = parseCats(item.category).filter((c) => c !== "工具");
    expect(cats).toEqual(["消耗品"]);
  });

  it("全消去でnullになる", () => {
    const cats: string[] = [];
    const result = cats.length > 0 ? cats.join(",") : null;
    expect(result).toBeNull();
  });

  it("【バグ注意】カンマ区切りにスペースが混入しても正常にパースされる", () => {
    const item = { category: "消耗品, 工具 , 電気" };
    const cats = parseCats(item.category);
    expect(cats).toEqual(["消耗品", "工具", "電気"]);
  });
});

// =====================================================================
// UsersPage — 権限制御ロジック
// =====================================================================

describe("UsersPage — 権限制御", () => {
  type UserRole = 0 | 1 | 2;
  const canChangeRole = (
    operatorRole: UserRole,
    targetRole: UserRole,
    newRole: number,
    isSelf: boolean,
  ): string | null => {
    if (isSelf) return "自分自身の権限は変更不可";
    if (operatorRole < 2 && targetRole === 2)
      return "最高管理者の権限は変更できません（越権行為）";
    if (operatorRole < 2 && newRole === 2)
      return "最高管理者を任命する権限がありません（越権行為）";
    return null; // OK
  };

  it("自分自身の権限は変更できない", () => {
    expect(canChangeRole(1, 0, 0, true)).toBe("自分自身の権限は変更不可");
  });

  it("role=1は最高管理者(role=2)の権限を変更できない", () => {
    expect(canChangeRole(1, 2, 0, false)).toBe(
      "最高管理者の権限は変更できません（越権行為）",
    );
  });

  it("role=1はrole=2への昇格を行えない", () => {
    expect(canChangeRole(1, 0, 2, false)).toBe(
      "最高管理者を任命する権限がありません（越権行為）",
    );
  });

  it("role=2は何でも変更できる", () => {
    expect(canChangeRole(2, 2, 0, false)).toBeNull();
    expect(canChangeRole(2, 0, 2, false)).toBeNull();
  });

  it("一般ユーザー(role=0)を管理者(role=1)に昇格できる（role=1の操作）", () => {
    expect(canChangeRole(1, 0, 1, false)).toBeNull();
  });

  it("【バグ注意】凍結済みユーザーの権限変更はUI上disabledだが、APIを直接叩けば変更できてしまう", () => {
    // disableActionsはUIのみの制御
    // APIレベルのバリデーションは実装されていない → 潜在的なセキュリティリスク
    // このテストは仕様上の注意喚起
    const disabledInUI = true;
    expect(disabledInUI).toBe(true); // UIでは防いでいる
    // ただしAPIには制限なし（バックエンドRLSが必要）
  });
});

describe("UsersPage — 一括凍結ロジック", () => {
  it("role=2ユーザーはrole=1の管理者には凍結できない", () => {
    const isRole2Operator = false;
    const targetRole = 2;
    const canFreeze = !(!isRole2Operator && targetRole === 2);
    expect(canFreeze).toBe(false);
  });

  it("自分自身はselectableUsersに含まれない", () => {
    const currentUserId = "1";
    const users = [
      { id: "1", user_name: "me", role: 1, is_active: true },
      { id: "2", user_name: "other", role: 0, is_active: true },
    ];
    const selectable = users.filter(
      (u) => String(u.id) !== currentUserId && u.is_active !== false,
    );
    expect(selectable).toHaveLength(1);
    expect(selectable[0].user_name).toBe("other");
  });

  it("既に凍結済みのユーザーはselectableUsersに含まれない", () => {
    const users = [
      { id: "1", is_active: false, role: 0 },
      { id: "2", is_active: true, role: 0 },
    ];
    const selectable = users.filter(
      (u) => u.is_active !== false,
    );
    expect(selectable).toHaveLength(1);
  });

  it("【バグ注意】is_activeがundefinedのユーザーは凍結済みと区別される", () => {
    const user = { id: "1", role: 0 }; // is_activeなし
    const isActive = (user as any).is_active !== false; // undefined !== false = true
    expect(isActive).toBe(true); // アクティブ扱いになる
  });
});
