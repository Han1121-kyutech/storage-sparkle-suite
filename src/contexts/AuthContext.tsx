import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@/types";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type AuthContextType = {
  currentUser: User | null;
  isLoading: boolean;
  login: (user_name: string, password?: string) => Promise<void>;
  register: (user_name: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const savedUserStr = localStorage.getItem("currentUser");
      if (savedUserStr) {
        try {
          const localUser = JSON.parse(savedUserStr) as User;

          // DBから最新の状態を取得（凍結・削除のチェック）
          const { data: latestUser, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", localUser.id)
            .maybeSingle();

          if (!error && latestUser && latestUser.is_active !== false) {
            // 有効なユーザーであれば状態を更新
            setCurrentUser(latestUser);
            localStorage.setItem("currentUser", JSON.stringify(latestUser));
          } else {
            // 凍結されていたり存在しない場合は強制ログアウト
            if (latestUser?.is_active === false) {
              toast.error("このアカウントは凍結されています。");
            }
            localStorage.removeItem("currentUser");
            setCurrentUser(null);
          }
        } catch (e) {
          localStorage.removeItem("currentUser");
          setCurrentUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (user_name: string, password?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_name", user_name)
        .maybeSingle();

      if (error) throw new Error("DB接続エラーが発生しました");
      if (!data) throw new Error("そのユーザー名は登録されていません");

      // 凍結（論理削除）チェック
      if (data.is_active === false) {
        throw new Error("このアカウントは凍結されています。");
      }

      // 管理者専用のパスワード検証
      if (data.role >= 1) {
        if (!password) {
          throw new Error("PASSWORD_REQUIRED");
        }
        if (data.password !== password) {
          throw new Error("パスワードが間違っています");
        }
      }

      setCurrentUser(data as User);
      localStorage.setItem("currentUser", JSON.stringify(data));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (user_name: string) => {
    setIsLoading(true);
    try {
      const { data: exists } = await supabase
        .from("users")
        .select("user_name")
        .eq("user_name", user_name)
        .maybeSingle();

      if (exists) throw new Error("このユーザー名は既に使用されています");

      const { data, error } = await supabase
        .from("users")
        .insert([{ user_name, role: 0 }])
        .select()
        .single();

      if (error) throw new Error("DBエラー: " + error.message);

      setCurrentUser(data as User);
      localStorage.setItem("currentUser", JSON.stringify(data));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
  };

  return (
    <AuthContext.Provider
      value={{ currentUser, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
