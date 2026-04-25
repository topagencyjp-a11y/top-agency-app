'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberNames, setMemberNames] = useState(['プラ','岩永','橋本','高木','長谷川','中西','佐藤','小島']);

  useEffect(() => {
    const stored = localStorage.getItem('members');
    if (stored) {
      try { setMemberNames(JSON.parse(stored).map((m: any) => m.name)); } catch {}
    }
    import('@/lib/api').then(({ getMembersFromGAS }) => {
      getMembersFromGAS().then(data => {
        if (data.length > 0) {
          localStorage.setItem('members', JSON.stringify(data));
          setMemberNames(data.map((m: any) => m.name));
        }
      });
    });
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } else {
      setError('名前またはパスワードが違います');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="page-animate bg-gray-900 rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-black">T</span>
          </div>
          <div className="text-2xl font-black text-white mb-1">TOP Agency</div>
          <div className="text-gray-400 text-sm">Sales Management</div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block uppercase tracking-wide">氏名</label>
            <select
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 text-white rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">選択してください</option>
              {memberNames.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs font-medium mb-2 block uppercase tracking-wide">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full bg-gray-800 text-white rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="パスワードを入力"
            />
          </div>
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3">
              <p className="text-red-400 text-sm text-center">{error}</p>
            </div>
          )}
          <button
            onClick={handleLogin}
            disabled={loading || !name || !password}
            className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl text-sm active:scale-95 transition-all duration-150 select-none disabled:opacity-40 mt-2"
          >
            {loading ? '認証中...' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  );
}
