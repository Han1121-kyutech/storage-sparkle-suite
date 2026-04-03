import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User } from "@/types";
import { supabase } from "@/lib/supabase";

type AuthContextType = {
  currentUser: User | null;
  isLoading: boolean;
  login: (user_name: string, password?: string) => Promise<void>; // 引数にpasswordを追加
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
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("currentUser");
      }
    }
    setIsLoading(false);
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

      // --- 管理者専用のパスワード検証ロジック ---
      if (data.role >= 1) {
        // パスワードがまだ送られてきていない場合はUI側に要求フラグを返す
        if (!password) {
          throw new Error("PASSWORD_REQUIRED");
        }
        // パスワードが送られてきたが、DBと一致しない場合
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
