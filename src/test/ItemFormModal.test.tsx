import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ItemFormModal from "@/components/ItemFormModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { sendInventoryNotification } from "@/utils/notificationUtils";

// =====================================================================
// モック設定
// =====================================================================
vi.mock("@/contexts/AuthContext");
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/utils/notificationUtils", () => ({
  sendInventoryNotification: vi.fn(),
}));

describe("ItemFormModal — 統合ロジックテスト", () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ヘルパー: 権限を偽装してレンダリング
  const setup = (role: number, item: any = null) => {
    (useAuth as any).mockReturnValue({ currentUser: { role } });
    return render(
      <ItemFormModal
        open={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        item={item}
      />,
    );
  };

  // ------------------------------------------------------------------
  // 1. 権限による表示・制限のテスト
  // ------------------------------------------------------------------
  it("一般ユーザー(Role 0)には『警告閾値』と『カテゴリ』の入力欄が表示されないこと", () => {
    setup(0);
    expect(screen.queryByLabelText(/警告閾値/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/カテゴリ上書き/)).not.toBeInTheDocument();
  });

  it("最高管理者(Role 2)には『警告閾値』と『カテゴリ』が表示されること", () => {
    setup(2);
    expect(screen.getByLabelText(/警告閾値/)).toBeInTheDocument();
    expect(screen.getByLabelText(/カテゴリ上書き/)).toBeInTheDocument();
  });

  // ------------------------------------------------------------------
  // 2. バリデーション（Role 2特有）のテスト
  // ------------------------------------------------------------------
  it("Role 2がカテゴリにカンマを入力した場合、エラーで停止すること", async () => {
    setup(2);
    fireEvent.change(screen.getByLabelText("物品名"), {
      target: { value: "テスト" },
    });
    fireEvent.change(screen.getByLabelText("保管場所"), {
      target: { value: "倉庫" },
    });
    fireEvent.change(screen.getByLabelText("棚番号"), {
      target: { value: "A-1" },
    });
    fireEvent.change(screen.getByLabelText(/カテゴリ上書き/), {
      target: { value: "カテゴリ1,カテゴリ2" },
    });

    fireEvent.click(screen.getByText("追加する"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "カテゴリ名にカンマ(,)は使用できません",
      );
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------
  // 3. データ保護（最重要バグチェック）
  // ------------------------------------------------------------------
  it("一般ユーザー(Role 0)が既存品を編集する際、カテゴリと閾値が送信データに含まれないこと", async () => {
    const existingItem = {
      id: 100,
      item_name: "高級工具",
      category: "重要物品",
      alert_threshold: 10,
    };
    setup(0, existingItem);

    // モックの戻り値を設定
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: 100 }, error: null });
    (supabase.from as any).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: mockSingle,
    });

    fireEvent.change(screen.getByLabelText("物品名"), {
      target: { value: "高級工具(編集済)" },
    });
    fireEvent.click(screen.getByText("更新する"));

    await waitFor(() => {
      const updateCall = (supabase.from as any)().update.mock.calls[0][0];
      // Role 0の編集では、item_nameなどは含まれるが、category/alert_thresholdは含まれていないはず
      expect(updateCall.item_name).toBe("高級工具(編集済)");
      expect(updateCall.category).toBeUndefined(); // ここが重要！
      expect(updateCall.alert_threshold).toBeUndefined(); // ここが重要！
    });
  });

  // ------------------------------------------------------------------
  // 4. 通知ロジックのテスト
  // ------------------------------------------------------------------
  it("新規登録成功時、正しいメッセージでDiscord通知が呼ばれること", async () => {
    setup(2);
    const mockSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: 1 }, error: null });
    (supabase.from as any).mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: mockSingle,
    });

    fireEvent.change(screen.getByLabelText("物品名"), {
      target: { value: "新品" },
    });
    fireEvent.change(screen.getByLabelText("保管場所"), {
      target: { value: "棚" },
    });
    fireEvent.change(screen.getByLabelText("棚番号"), {
      target: { value: "B-1" },
    });
    fireEvent.change(screen.getByLabelText("在庫数"), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByText("追加する"));

    await waitFor(() => {
      expect(sendInventoryNotification).toHaveBeenCalledWith(
        expect.stringContaining("✨ **新規物品登録**"),
      );
      expect(sendInventoryNotification).toHaveBeenCalledWith(
        expect.stringContaining("名前: 新品"),
      );
    });
  });

  // ------------------------------------------------------------------
  // 5. ローディング状態のテスト
  // ------------------------------------------------------------------
  it("送信中はボタンが『保存中...』になり、inputがdisabledになること", async () => {
    setup(2);
    // 意図的にレスポンスを遅延させる
    (supabase.from as any).mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: {}, error: null }), 100),
        ),
    });

    fireEvent.change(screen.getByLabelText("物品名"), {
      target: { value: "待機テスト" },
    });
    fireEvent.click(screen.getByText("追加する"));

    expect(screen.getByText("保存中...")).toBeInTheDocument();
    expect(screen.getByLabelText("物品名")).toBeDisabled();
  });
});
