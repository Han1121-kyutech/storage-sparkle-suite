import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Warehouse, Loader2, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const LoginPage = () => {
  const { login, register, isLoading, currentUser } = useAuth();
  const navigate = useNavigate();

  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState(""); // パスワード状態
  const [requirePassword, setRequirePassword] = useState(false); // パスワード入力欄の表示フラグ
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      navigate("/dashboard");
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userName.trim()) {
      setError("ユーザー名を入力してください");
      return;
    }

    // パスワード入力モードに入っているのに空欄の場合は弾く
    if (requirePassword && !password.trim()) {
      setError("パスワードを入力してください");
      return;
    }

    try {
      // requirePasswordがtrueの時だけパスワードを渡す
      await login(
        userName.trim(),
        requirePassword ? password.trim() : undefined,
      );
      toast.success("ログインしました");
      navigate("/dashboard");
    } catch (err: any) {
      if (err.message === "PASSWORD_REQUIRED") {
        // 管理者アカウントであることが判明した場合、エラーを出さずにパスワード欄を表示
        setRequirePassword(true);
      } else {
        setError(err.message);
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!userName.trim()) {
      setError("ユーザー名を入力してください");
      return;
    }
    try {
      await register(userName.trim());
      toast.success("ユーザー登録が完了しました");
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
    }
  };

  // タブ切り替え時に状態をリセットする
  const resetForm = () => {
    setError(null);
    setUserName("");
    setPassword("");
    setRequirePassword(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 antialiased">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 transition-transform hover:scale-105 duration-300">
              <Warehouse className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            倉庫整理
          </h1>
        </div>

        <Tabs defaultValue="login" className="w-full" onValueChange={resetForm}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" disabled={isLoading}>
              ログイン
            </TabsTrigger>
            <TabsTrigger value="register" disabled={isLoading}>
              新規登録
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="login"
            className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <Card>
              <CardHeader>
                <CardTitle>ログイン</CardTitle>
                <CardDescription>
                  {requirePassword
                    ? "管理者アカウントです。パスワードを入力してください"
                    : "登録済みのユーザー名を入力してください"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">ユーザー名</Label>
                    <Input
                      id="login-username"
                      placeholder="ユーザー名を入力..."
                      value={userName}
                      onChange={(e) => {
                        setUserName(e.target.value);
                        setRequirePassword(false); // 名前を変えたらパスワード欄は一旦隠す
                        setPassword("");
                      }}
                      disabled={isLoading || requirePassword} // パスワード入力中は名前を変えられないようにロック
                      autoComplete="off"
                      className="transition-all focus:ring-2 ring-primary/50"
                    />
                  </div>

                  {/* 管理者と判定された場合のみスライドインで出現 */}
                  {requirePassword && (
                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-300">
                      <Label
                        htmlFor="login-password"
                        className="flex items-center gap-1 text-primary"
                      >
                        <Lock className="h-3 w-3" /> パスワード
                      </Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="パスワードを入力..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="transition-all focus:ring-2 ring-primary border-primary/50"
                        autoFocus
                      />
                    </div>
                  )}

                  {error && (
                    <p className="text-sm font-bold text-destructive animate-bounce">
                      {error}
                    </p>
                  )}

                  <Button
                    className="w-full font-bold"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        認証中...
                      </>
                    ) : requirePassword ? (
                      "パスワードを送信してログイン"
                    ) : (
                      "ログインする"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            value="register"
            className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300"
          >
            <Card>
              <CardHeader>
                <CardTitle>新規登録</CardTitle>
                <CardDescription>
                  新しいユーザー名を入力してアカウントを作成します
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-username">ユーザー名</Label>
                    <Input
                      id="register-username"
                      placeholder="ユーザー名を入力..."
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      disabled={isLoading}
                      autoComplete="off"
                      className="transition-all focus:ring-2 ring-primary/50"
                    />
                  </div>
                  {error && (
                    <p className="text-sm font-bold text-destructive animate-bounce">
                      {error}
                    </p>
                  )}
                  <Button
                    className="w-full font-bold"
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        登録中...
                      </>
                    ) : (
                      "アカウント作成"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LoginPage;
