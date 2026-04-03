import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Warehouse, Loader2 } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  // 既にログインしている場合はダッシュボードへ遷移
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
    try {
      await login(userName.trim());
      toast.success("ログインしました");
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message);
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

        <Tabs
          defaultValue="login"
          className="w-full"
          onValueChange={() => {
            setError(null);
            setUserName("");
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            {/* 処理中のタブ切り替えを防止 */}
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
                  登録済みのユーザー名を入力してください
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
                      onChange={(e) => setUserName(e.target.value)}
                      disabled={isLoading} // 処理中の入力改ざんを防止
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
                        認証中...
                      </>
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
                      disabled={isLoading} // 処理中の入力改ざんを防止
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
