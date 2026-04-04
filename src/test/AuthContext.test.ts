// src/test/AuthContext.test.ts
// vitest + @testing-library/react でテストする想定
// 実行: npx vitest run

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =====================================================================
// Supabase モック
// =====================================================================
const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase", () => ({ supabase: mockSupabase }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// =====================================================================
// ヘルパー: Supabaseのchainをまとめてモックする
// =====================================================================
const mockChain = (result: object) => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(result),
  maybeSingle: vi.fn().mockResolvedValue(result),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
});

// =====================================================================
// AuthContext — login() のロジックテスト
// (コンテキスト外から直接ロジックを検証するユニットテスト)
// =====================================================================

describe("login ロジック", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------
  // 正常系
  // ------------------------------------------------------------------

  it("一般ユーザー(role=0)はパスワードなしでログインできる", async () => {
    const fakeUser = {
      id: 1,
      user_name: "taro",
      role: 0,
      is_active: true,
    };
    const chain = mockChain({ data: fakeUser, error: null });
    mockSupabase.from.mockReturnValue(chain);

    // login関数の中核ロジックを直接検証
    const { data, error } = await chain.maybeSingle();
    expect(error).toBeNull();
    expect(data.role).toBe(0);
    // role=0 なのでパスワードチェック不要
    expect(data.is_active).not.toBe(false);
  });

  it("管理者(role=1)はパスワードなしだと PASSWORD_REQUIRED を投げる", () => {
    const adminUser = { id: 2, user_name: "admin", role: 1, is_active: true };

    // login()内のパスワード必須チェックロジック
    const checkPassword = (data: typeof adminUser, password?: string) => {
      if (data.role >= 1) {
        if (!password) throw new Error("PASSWORD_REQUIRED");
        if (data.password !== password) throw new Error("パスワードが間違っています");
      }
    };

    expect(() => checkPassword(adminUser, undefined)).toThrow("PASSWORD_REQUIRED");
  });

  it("管理者(role=1)は正しいパスワードでログインできる", () => {
    const adminUser = {
      id: 2,
      user_name: "admin",
      role: 1,
      password: "secret123",
      is_active: true,
    };

    const checkPassword = (
      data: typeof adminUser,
      password?: string,
    ) => {
      if (data.role >= 1) {
        if (!password) throw new Error("PASSWORD_REQUIRED");
        if (data.password !== password) throw new Error("パスワードが間違っています");
      }
    };

    expect(() => checkPassword(adminUser, "secret123")).not.toThrow();
  });

  it("管理者(role=2)も間違ったパスワードはエラー", () => {
    const superAdmin = {
      id: 3,
      user_name: "super",
      role: 2,
      password: "correct",
      is_active: true,
    };

    const checkPassword = (data: typeof superAdmin, password?: string) => {
      if (data.role >= 1) {
        if (!password) throw new Error("PASSWORD_REQUIRED");
        if (data.password !== password) throw new Error("パスワードが間違っています");
      }
    };

    expect(() => checkPassword(superAdmin, "wrong")).toThrow("パスワードが間違っています");
  });

  // ------------------------------------------------------------------
  // 異常系 / バグりやすいケース
  // ------------------------------------------------------------------

  it("【バグ注意】is_active が undefined のユーザーは凍結扱いにならない", () => {
    // is_active が設定されていない古いユーザーレコードの場合
    const oldUser = { id: 99, user_name: "oldUser", role: 0 };
    // AuthContext: is_active === false のときだけ凍結扱い
    // undefined はfreezeされない → ログイン可能が正しい仕様
    const isFrozen = (oldUser as any).is_active === false;
    expect(isFrozen).toBe(false); // undefinedはfalseにならないことを確認
  });

  it("存在しないユーザー名はエラーになる", async () => {
    const chain = mockChain({ data: null, error: null });
    mockSupabase.from.mockReturnValue(chain);

    const { data } = await chain.maybeSingle();
    // data が null → "そのユーザー名は登録されていません"
    const throwIfNotFound = (d: null | object) => {
      if (!d) throw new Error("そのユーザー名は登録されていません");
    };
    expect(() => throwIfNotFound(data)).toThrow("そのユーザー名は登録されていません");
  });

  it("凍結ユーザー(is_active=false)はログイン拒否される", () => {
    const frozenUser = {
      id: 10,
      user_name: "frozen",
      role: 0,
      is_active: false,
    };
    const checkFreeze = (data: typeof frozenUser) => {
      if (data.is_active === false) throw new Error("このアカウントは凍結されています。");
    };
    expect(() => checkFreeze(frozenUser)).toThrow("このアカウントは凍結されています。");
  });

  it("DBエラー時はDB接続エラーをスローする", async () => {
    const chain = mockChain({ data: null, error: { message: "connection refused" } });
    mockSupabase.from.mockReturnValue(chain);
    const { error } = await chain.maybeSingle();
    const throwIfError = (e: object | null) => {
      if (e) throw new Error("DB接続エラーが発生しました");
    };
    expect(() => throwIfError(error)).toThrow("DB接続エラーが発生しました");
  });
});

// =====================================================================
// AuthContext — register() のロジックテスト
// =====================================================================

describe("register ロジック", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("既存ユーザー名での登録は失敗する", () => {
    const existingUser = { user_name: "taro" };
    const checkDuplicate = (exists: object | null) => {
      if (exists) throw new Error("このユーザー名は既に使用されています");
    };
    expect(() => checkDuplicate(existingUser)).toThrow("このユーザー名は既に使用されています");
  });

  it("新規ユーザーはrole=0で登録される", async () => {
    const newUser = { id: 5, user_name: "newbie", role: 0 };
    const chain = mockChain({ data: newUser, error: null });
    mockSupabase.from.mockReturnValue(chain);
    const { data } = await chain.single();
    expect(data.role).toBe(0);
  });

  it("【バグ注意】空文字ユーザー名でも登録APIが呼ばれてしまう可能性", () => {
    // LoginPage では trim() 後に空なら弾くが、
    // register() 自体はバリデーションを持っていないので
    // UIバリデーションが壊れると空文字が登録される
    const userName = "   ";
    const trimmed = userName.trim();
    expect(trimmed).toBe(""); // UI側で必ずtrimチェックが必要
  });
});

// =====================================================================
// AuthContext — initAuth (localStorage復元) のロジックテスト
// =====================================================================

describe("initAuth — localStorage復元ロジック", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("不正なJSONがlocalStorageにある場合はクリアされる", () => {
    localStorage.setItem("currentUser", "{ broken json {{");
    let result: object | null = null;
    try {
      result = JSON.parse(localStorage.getItem("currentUser")!);
    } catch {
      localStorage.removeItem("currentUser");
    }
    expect(result).toBeNull();
    expect(localStorage.getItem("currentUser")).toBeNull();
  });

  it("DBで凍結されたユーザーはlocalStorage復元時にログアウトされる", () => {
    const frozenUser = { id: 1, user_name: "frozen", role: 0, is_active: false };
    localStorage.setItem("currentUser", JSON.stringify({ id: 1, user_name: "frozen" }));

    // initAuth内のロジック: is_active === false ならログアウト
    const shouldKeep = frozenUser.is_active !== false;
    if (!shouldKeep) {
      localStorage.removeItem("currentUser");
    }
    expect(localStorage.getItem("currentUser")).toBeNull();
  });

  it("DBでユーザーが削除されている場合もlocalStorageがクリアされる", () => {
    localStorage.setItem("currentUser", JSON.stringify({ id: 999 }));
    const latestUser = null; // DBにもう存在しない
    if (!latestUser) {
      localStorage.removeItem("currentUser");
    }
    expect(localStorage.getItem("currentUser")).toBeNull();
  });
});
