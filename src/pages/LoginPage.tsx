import { useAuth } from '@/contexts/AuthContext';
import { mockUsers } from '@/data/mockData';
import { Warehouse, User } from 'lucide-react';

const LoginPage = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-4 rounded-xl bg-card border border-border">
              <Warehouse className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-mono text-primary">倉庫管理システム</h1>
          <p className="text-sm text-muted-foreground">ユーザーを選択してログイン</p>
        </div>

        <div className="space-y-3">
          {mockUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => login(user.id)}
              className="w-full flex items-center gap-4 p-4 rounded-lg bg-card border border-border hover:border-primary/50 hover:bg-secondary transition-all group"
            >
              <div className="p-2 rounded-md bg-secondary group-hover:bg-primary/20 transition-colors">
                <User className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{user.user_name}</p>
                <p className="text-xs font-mono text-muted-foreground">
                  {user.role === 'admin' ? '管理者' : '一般ユーザー'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
