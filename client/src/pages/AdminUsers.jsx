import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, UserCog, UserRound } from 'lucide-react';
import { adminAPI } from '../api';

const roleStyles = {
  admin: 'bg-purple-50 text-purple-700',
  seller: 'bg-emerald-50 text-emerald-700',
  salesperson: 'bg-emerald-50 text-emerald-700',
  user: 'bg-slate-100 text-slate-600',
};

const roleLabels = {
  admin: 'Admin',
  seller: 'Seller',
  salesperson: 'Seller',
  user: 'User',
};

export default function AdminUsers({ manageRoles = false }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState('');

  const loadUsers = useCallback(async () => {
    setError('');
    try {
      setUsers(await adminAPI.getUsers());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return users.filter((user) => !value || `${user.name} ${user.username} ${user.role} ${user.id}`.toLowerCase().includes(value));
  }, [users, query]);

  const updateRole = async (user, role) => {
    if (user.role === role || user.role === 'admin') return;
    setSavingUserId(user.id);
    setError('');
    setMessage('');
    try {
      const updated = await adminAPI.updateUserRole(user.id, role);
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(`${updated.name || updated.username} is now ${roleLabels[updated.role]}.`);
    } catch (err) {
      setError(err.message || 'Unable to update this member role.');
    } finally {
      setSavingUserId('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16 pt-24">
      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Admin</p>
          <h1 className="font-heading text-4xl font-bold text-slate-900">
            {manageRoles ? 'Member role management' : 'User information lookup'}
          </h1>
          <p className="mt-2 text-slate-500">
            {manageRoles
              ? 'Assign registered members as sellers or return them to the standard user role. Admin accounts remain protected.'
              : 'Search account identifiers, names and permission roles. Passwords and tokens are never returned.'}
          </p>
        </header>

        <label className="relative mb-6 block max-w-xl">
          <span className="sr-only">Search users</span>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, username, role or ID"
            className="w-full rounded-xl border-slate-300 py-3 pl-11"
          />
        </label>

        {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-4 text-emerald-700">{message}</p>}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4 text-sm text-slate-500">
            {loading ? 'Loading users…' : `${filtered.length} account(s)`}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-left text-sm text-slate-500">
                <tr>
                  <th className="p-4">Member</th>
                  <th className="p-4">Username</th>
                  <th className="p-4">Role</th>
                  {manageRoles && <th className="p-4">Set role</th>}
                  <th className="p-4">ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="p-4">
                      <span className="flex items-center gap-3 font-semibold text-slate-900">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-primary"><UserRound size={18} /></span>
                        {user.name}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{user.username}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${roleStyles[user.role] || roleStyles.user}`}>
                        <ShieldCheck size={13} />{roleLabels[user.role] || user.role}
                      </span>
                    </td>
                    {manageRoles && (
                      <td className="p-4">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400"><UserCog size={15} />Protected</span>
                        ) : (
                          <select
                            value={user.role}
                            disabled={savingUserId === user.id}
                            onChange={(event) => updateRole(user, event.target.value)}
                            className="rounded-xl border-slate-300 py-2 text-sm disabled:opacity-50"
                            aria-label={`Set role for ${user.name || user.username}`}
                          >
                            <option value="user">User</option>
                            <option value="seller">Seller</option>
                          </select>
                        )}
                      </td>
                    )}
                    <td className="p-4 font-mono text-xs text-slate-400">{user.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
