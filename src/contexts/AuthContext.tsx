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
  login: (user_name: string) => Promise<void>;
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

  const login = async (user_name: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_name", user_name)
        .maybeSingle();

      if (error) throw new Error("DB接続エラーが発生しました");
      if (!data) throw new Error("そのユーザー名は登録されていません");

      setCurrentUser(data as User);
      localStorage.setItem("currentUser", JSON.stringify(data));
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (user_name: string) => {
    setIsLoading(true);
    try {
      // 1. 重複チェック
      const { data: exists } = await supabase
        .from("users")
        .select("user_name")
        .eq("user_name", user_name)
        .maybeSingle();

      if (exists) throw new Error("このユーザー名は既に使用されています");

      // 2. 登録（IDはDB側で自動生成させるため送信しない）
      const { data, error } = await supabase
        .from("users")
        .insert([{ user_name, role: "general" }])
        .select()
        .single();

      if (error)
        throw new Error("登録に失敗しました。DB設定を確認してください。");

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
