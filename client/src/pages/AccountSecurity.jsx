import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { authAPI, wsClient } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AccountSecurity() {
  const { user, updateLocalUser } = useAuth();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(Boolean(user?.mfaEnabled && user?.mfaVerified));

  const start = async () => { setError(''); try { setSetup(await authAPI.setupMfa()); } catch (requestError) { setError(requestError.message); } };
  const enable = async (event) => { event.preventDefault(); setError(''); try { const result = await authAPI.enableMfa(code); const updated = { ...result.user, token: result.token }; updateLocalUser(updated); wsClient.setToken(result.token); setDone(true); setSetup(null); } catch (requestError) { setError(requestError.message); } };

  return <div className="min-h-screen bg-[#f8f4ec] px-5 pb-20 pt-32"><main className="mx-auto max-w-xl rounded-3xl bg-white p-7 shadow-sm sm:p-10"><ShieldCheck size={36} className="text-[#a84d33]" /><h1 className="mt-4 font-heading text-3xl font-bold text-[#17251f]">Staff account security</h1><p className="mt-3 text-[#59655f]">Seller and administrator accounts must use a time-based authenticator code before accessing staff tools.</p>
    {done ? <p role="status" className="mt-7 rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">Two-factor authentication is enabled and verified.</p> : !setup ? <button type="button" onClick={start} className="mt-7 rounded-full bg-[#17251f] px-6 py-3 font-semibold text-white">Set up authenticator</button> : <form onSubmit={enable} className="mt-7 space-y-5"><div className="rounded-xl bg-slate-50 p-4"><p className="text-sm">Add an account manually in Google Authenticator, Microsoft Authenticator, 1Password, or another TOTP app.</p><p className="mt-3 break-all font-mono text-lg font-bold tracking-wider text-[#17251f]">{setup.secret}</p><details className="mt-3 text-xs"><summary className="cursor-pointer">Show setup URI</summary><p className="mt-2 break-all font-mono">{setup.uri}</p></details></div><label className="block text-sm font-semibold">Enter the current 6-digit code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} className="mt-2 block w-full rounded-xl border-slate-300" /></label><button className="rounded-full bg-[#17251f] px-6 py-3 font-semibold text-white">Verify and enable</button></form>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </main></div>;
}
