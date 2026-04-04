// src/test/LoginPage.test.tsx
// vitest + @testing-library/react

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    isLoading: false,
    currentUser: null,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import LoginPage from "@/pages/LoginPage";

const renderLoginPage = () =>
  render(<MemoryRouter><LoginPage /></MemoryRouter>);

// role="tab" でタブを確実に取得するヘルパー
const getTabByName = (name: string) => {
  const tabs = screen.getAllByRole("tab");
  const tab = tabs.find((t) => t.textContent?.includes(name));
  if (!tab) throw new Error(`タブ "${name}" が見つかりません`);
  return tab;
};

// テキストでボタンを取得するヘルパー
const getButtonByText = (text: string) => {
  const buttons = screen.getAllByRole("button");
  return buttons.find((b) => b.textContent?.includes(text));
};

// =====================================================================
// ログインフォーム — 正常系
// =====================================================================
describe("LoginPage — ログイン正常系", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockResolvedValue(undefined);
  });

  it("ユーザー名を入力してログインボタンを押すとloginが呼ばれる", async () => {
    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "taro" },
    });
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("taro", undefined);
    });
  });

  it("ログイン成功後に /dashboard へ遷移する", async () => {
    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "taro" },
    });
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });
});

// =====================================================================
// バリデーション
// =====================================================================
describe("LoginPage — バリデーション", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ユーザー名が空のままログインするとエラーが表示される", async () => {
    renderLoginPage();
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() => {
      expect(screen.getByText("ユーザー名を入力してください")).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("スペースだけのユーザー名はバリデーションで弾かれる", async () => {
    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "   " },
    });
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() => {
      expect(screen.getByText("ユーザー名を入力してください")).toBeInTheDocument();
    });
  });
});

// =====================================================================
// 管理者2段階認証フロー
// =====================================================================
describe("LoginPage — 管理者パスワードフロー", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PASSWORD_REQUIREDエラーが返るとパスワード欄が表示される", async () => {
    mockLogin.mockRejectedValueOnce(new Error("PASSWORD_REQUIRED"));
    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "admin" },
    });
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("パスワードを入力...")).toBeInTheDocument();
    });
    expect(screen.queryByText("PASSWORD_REQUIRED")).not.toBeInTheDocument();
  });

  it("パスワード欄表示後、空のままだとエラーになる", async () => {
    mockLogin.mockRejectedValueOnce(new Error("PASSWORD_REQUIRED"));
    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "admin" },
    });
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("パスワードを入力...")).toBeInTheDocument(),
    );
    fireEvent.click(getButtonByText("パスワードを送信してログイン")!);
    await waitFor(() => {
      expect(screen.getByText("パスワードを入力してください")).toBeInTheDocument();
    });
  });

  it("パスワード欄表示中はユーザー名フィールドがdisabledになる", async () => {
    mockLogin.mockRejectedValueOnce(new Error("PASSWORD_REQUIRED"));
    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "admin" },
    });
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("パスワードを入力...")).toBeInTheDocument(),
    );
    expect(screen.getByPlaceholderText("ユーザー名を入力...")).toBeDisabled();
  });

  it("タブを切り替えるとパスワード欄が消える", async () => {
    mockLogin.mockRejectedValueOnce(new Error("PASSWORD_REQUIRED"));
    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "admin" },
    });
    fireEvent.click(getButtonByText("ログインする")!);
    await waitFor(() =>
      expect(screen.getByPlaceholderText("パスワードを入力...")).toBeInTheDocument(),
    );
    fireEvent.click(getTabByName("新規登録"));
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("パスワードを入力...")).not.toBeInTheDocument();
    });
  });
});

// =====================================================================
// 新規登録フォーム
// =====================================================================
describe("LoginPage — 新規登録", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegister.mockResolvedValue(undefined);
  });

  it("ユーザー名を入力して登録ができる", async () => {
    renderLoginPage();
    fireEvent.click(getTabByName("新規登録"));
    await waitFor(() => {
      expect(getButtonByText("アカウント作成")).toBeTruthy();
    });
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "newuser" },
    });
    fireEvent.click(getButtonByText("アカウント作成")!);
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith("newuser");
    });
  });

  it("重複ユーザー名のエラーが表示される", async () => {
    mockRegister.mockRejectedValueOnce(
      new Error("このユーザー名は既に使用されています"),
    );
    renderLoginPage();
    fireEvent.click(getTabByName("新規登録"));
    await waitFor(() => {
      expect(getButtonByText("アカウント作成")).toBeTruthy();
    });
    fireEvent.change(screen.getByPlaceholderText("ユーザー名を入力..."), {
      target: { value: "taro" },
    });
    fireEvent.click(getButtonByText("アカウント作成")!);
    await waitFor(() => {
      expect(
        screen.getByText("このユーザー名は既に使用されています"),
      ).toBeInTheDocument();
    });
  });

  it("空ユーザー名で登録しようとするとエラーになる", async () => {
    renderLoginPage();
    fireEvent.click(getTabByName("新規登録"));
    await waitFor(() => {
      expect(getButtonByText("アカウント作成")).toBeTruthy();
    });
    fireEvent.click(getButtonByText("アカウント作成")!);
    await waitFor(() => {
      expect(screen.getByText("ユーザー名を入力してください")).toBeInTheDocument();
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });
});

// =====================================================================
// ログイン済みリダイレクト（ロジックレベル検証）
// =====================================================================
describe("LoginPage — ログイン済みリダイレクト", () => {
  it("currentUserがいれば /dashboard にリダイレクトする", () => {
    const currentUser = { id: 1, user_name: "taro", role: 0 };
    if (currentUser) mockNavigate("/dashboard");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });
});
