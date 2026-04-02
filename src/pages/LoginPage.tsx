import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { mockUsers } from '@/data/mockData';
import { Warehouse, User as UserIcon, UserPlus } from 'lucide-react';

const LoginPage = () => {
  const { login, register } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [newName, setNewName] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    register(newName.trim());
    setNewName('');
    setShowRegister(false);
  };

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
                <UserIcon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
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

        {/* Register toggle */}
        <div className="border-t border-border pt-6">
          {!showRegister ? (
            <button
              onClick={() => setShowRegister(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-border text-muted-foreground text-sm hover:border-primary/50 hover:text-primary transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              新規ユーザー登録
            </button>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">新規ユーザー登録</h3>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ユーザー名を入力"
                className="w-full px-3 py-2 rounded-md bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowRegister(false); setNewName(''); }}
                  className="flex-1 py-2 rounded-lg bg-secondary text-muted-foreground text-sm hover:bg-secondary/80 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  登録してログイン
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
