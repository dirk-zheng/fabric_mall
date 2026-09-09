import { useEffect, useState } from 'react';
import { Download, Save, Trash2 } from 'lucide-react';
import { privacyAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function PrivacyChoices() {
  const { user, logout, updateLocalUser } = useAuth();
  const [marketingEmail, setMarketingEmail] = useState(false);
  const [saleOptOut, setSaleOptOut] = useState(true);
  const [name, setName] = useState(user?.name || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    privacyAPI.getConsents().then(({ consents }) => {
      const latest = (type) => [...consents].reverse().find((item) => item.consentType === type)?.granted;
      setMarketingEmail(Boolean(latest('marketing_email')));
      setSaleOptOut(latest('sale_sharing_opt_out') ?? true);
    }).catch(() => {});
  }, [user?.account]);

  const run = async (action, success) => { setError(''); setStatus(''); try { await action(); setStatus(success); } catch (requestError) { setError(requestError.message); } };
  const savePreferences = () => run(async () => { await privacyAPI.recordConsent('marketing_email', marketingEmail); await privacyAPI.recordConsent('sale_sharing_opt_out', saleOptOut); }, 'Privacy preferences saved.');
  const exportData = () => run(async () => { const data = await privacyAPI.exportData(); const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `curva-account-export-${Date.now()}.json`; anchor.click(); URL.revokeObjectURL(url); }, 'Your export has been downloaded.');
  const updateName = () => run(async () => { const updated = await privacyAPI.updateProfile(name); updateLocalUser({ name: updated.name }); }, 'Profile corrected.');
  const deleteAccount = () => run(async () => { await privacyAPI.deleteAccount(password, confirmation); logout(); }, 'Account data deleted.');

  return <div className="min-h-screen bg-[#f8f4ec] px-5 pb-20 pt-32"><main className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a84d33]">Privacy center</p><h1 className="mt-3 font-heading text-4xl font-bold text-[#17251f]">Privacy Choices</h1><p className="mt-4 text-[#59655f]">Control optional communications and submit account data requests. We currently do not sell personal information or share it for cross-context behavioral advertising.</p>
    <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="font-heading text-2xl font-bold">Communication choices</h2><div className="mt-5 space-y-4 text-sm">
      <label className="flex items-start gap-3"><input type="checkbox" checked={marketingEmail} onChange={(event) => setMarketingEmail(event.target.checked)} className="mt-1 rounded" /><span><strong>Marketing email</strong><br />Receive optional product and sourcing updates. Quote and service messages are not marketing.</span></label>
      <label className="flex items-start gap-3"><input type="checkbox" checked={saleOptOut} onChange={(event) => setSaleOptOut(event.target.checked)} className="mt-1 rounded" /><span><strong>Opt out of sale/sharing</strong><br />Keep this preference recorded if our data practices change.</span></label>
      <button type="button" onClick={savePreferences} className="inline-flex items-center gap-2 rounded-full bg-[#17251f] px-5 py-2.5 font-semibold text-white"><Save size={16} />Save choices</button>
    </div></section>
    {user ? <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><h2 className="font-heading text-2xl font-bold">Account data requests</h2><div className="mt-5 grid gap-6">
      <div><button type="button" onClick={exportData} className="inline-flex items-center gap-2 rounded-full border border-[#17251f] px-5 py-2.5 font-semibold"><Download size={16} />Download my data</button></div>
      <form onSubmit={(event) => { event.preventDefault(); updateName(); }}><label className="block text-sm font-semibold">Correct display name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required className="mt-2 block w-full rounded-xl border-slate-300" /></label><button className="mt-3 rounded-full bg-[#17251f] px-5 py-2.5 text-sm font-semibold text-white">Save name</button></form>
      <form onSubmit={(event) => { event.preventDefault(); deleteAccount(); }} className="rounded-2xl border border-red-200 bg-red-50 p-5"><h3 className="font-bold text-red-900">Delete account data</h3><p className="mt-1 text-sm text-red-800">This permanently removes linked visitor records, behavior, quotes and conversations where legally permitted.</p><label className="mt-4 block text-sm font-semibold">Current password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={72} className="mt-2 block w-full rounded-xl border-red-200" /></label><label className="mt-3 block text-sm font-semibold">Type DELETE<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required pattern="DELETE" className="mt-2 block w-full rounded-xl border-red-200" /></label><button className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-2.5 text-sm font-semibold text-white"><Trash2 size={16} />Delete my data</button></form>
    </div></section> : <p className="mt-6 rounded-2xl bg-white p-5 text-sm text-[#59655f]">Sign in to download, correct, or delete account-linked information. Preferences above can be saved without an account for this browser visitor ID.</p>}
    {status && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p>}{error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </main></div>;
}
