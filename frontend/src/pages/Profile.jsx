import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../App';
import { apiGet, apiPost, apiDelete } from '../services/api';

export default function Profile() {
  const { user, setUser } = useContext(UserContext);
  const [name, setName] = useState(user?.name || '');
  const [contacts, setContacts] = useState([]);
  const [sentEmails, setSentEmails] = useState([]);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      apiGet(`/api/users/${user.id}/contacts`)
        .then(setContacts)
        .catch(() => autoRepairProfile(user.name || 'Traveler'));

      apiGet(`/api/users/${user.id}/sent_emails`)
        .then(setSentEmails)
        .catch(() => {});
    }
  }, [user]);

  const autoRepairProfile = async (profileName) => {
    try {
      const res = await apiPost('/api/users', { name: profileName });
      const userToken = res.sessionToken || res.token;
      const userObj = { id: res.id, token: userToken, name: res.name };
      localStorage.setItem('sr_session', JSON.stringify(userObj));
      setUser(userObj);
      setError('');
    } catch (e) {}
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      const res = await apiPost('/api/users', { name: name.trim() });
      const userToken = res.sessionToken || res.token;
      const userObj = { ...user, id: res.id, token: userToken, name: res.name };
      localStorage.setItem('sr_session', JSON.stringify(userObj));
      setUser(userObj);
      setSuccessMsg('✓ Profile name updated!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to save profile.');
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!cName || !cEmail) return;
    setError('');
    let formattedEmail = cEmail.trim();
    if (formattedEmail.endsWith('.')) {
      formattedEmail = formattedEmail.slice(0, -1) + '.com';
    }
    try {
      const res = await apiPost(`/api/users/${user.id}/contacts`, {
        name: cName.trim(),
        email: formattedEmail,
        phone: cPhone.trim() || '+1234567890'
      });
      setContacts([...contacts, res]);
      setCName('');
      setCEmail('');
      setCPhone('');
      setSuccessMsg('✓ Trusted contact added!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err?.detail || err?.message || 'Failed to add contact.');
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await apiDelete(`/api/users/${user.id}/contacts/${contactId}`);
      setContacts(contacts.filter(c => c.id !== contactId));
    } catch (err) {
      setError('Failed to delete contact.');
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-screen">
        <form onSubmit={handleSaveProfile} className="glass-card p-8 w-full max-w-sm border border-slate-700/80 shadow-2xl">
          <div className="text-4xl text-center mb-3">🛡️</div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">Setup Safety Profile</h2>
          <p className="text-xs text-slate-400 text-center mb-6">Enter your name to initialize your personal safety companion.</p>
          <input 
            type="text" 
            placeholder="Your Full Name (e.g. Rachit)" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full bg-slate-800/90 border border-slate-700 rounded-xl p-3.5 mb-6 text-white text-sm outline-none" 
            required 
          />
          <button type="submit" className="btn-info w-full py-3.5 rounded-xl font-bold text-sm shadow-lg">Create Profile & Start</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto w-full min-h-screen pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">Profile & Emergency Setup</h2>
          <p className="text-xs text-slate-400">Configure identity and trusted emergency contacts.</p>
        </div>
        <button onClick={() => navigate('/')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-700">
          ← Dashboard
        </button>
      </div>

      {error && <div className="bg-red-950/90 border border-red-500 text-red-200 p-3 rounded-xl text-xs mb-4">⚠️ {error}</div>}
      {successMsg && <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-200 p-3 rounded-xl text-xs mb-4 text-center font-bold">{successMsg}</div>}

      {/* Traveler Identity Card */}
      <div className="glass-card p-6 mb-6 border border-slate-700/80 shadow-xl relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Traveler Identity</span>
            <h3 className="text-2xl font-black text-white mt-0.5">{user.name}</h3>
          </div>
          <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-3 py-1 rounded-full shadow">
            ● Session Active
          </span>
        </div>

        <form onSubmit={handleSaveProfile} className="flex gap-2 pt-2 border-t border-slate-800">
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none" 
            placeholder="Update Name"
          />
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-sr-info border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap">
            Update Name
          </button>
        </form>
      </div>

      {/* Trusted Contacts Card */}
      <div className="glass-card p-6 mb-6 border border-slate-700/80 shadow-xl">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <span>🛡️</span> Trusted Emergency Contacts
          </h3>
          <span className="text-xs font-bold text-sr-info bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-700/40">
            {contacts.length} / 3 Max
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          Contacts receive instant emergency emails with photos, audio clips, timestamped voice logs & live map links.
        </p>

        <div className="space-y-3 mb-6">
          {contacts.map(c => (
            <div key={c.id} className="bg-slate-900/90 p-3.5 rounded-xl flex justify-between items-center border border-slate-800">
              <div>
                <p className="font-bold text-white text-sm">{c.name}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{c.email} • {c.phone}</p>
              </div>
              <button 
                onClick={() => handleDeleteContact(c.id)} 
                className="bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-800/40 text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                Remove
              </button>
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="p-4 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/40 text-xs text-slate-400">
              No contacts added yet. Add a contact email below to receive instant emergency alerts!
            </div>
          )}
        </div>

        {contacts.length < 3 ? (
          <form onSubmit={handleAddContact} className="space-y-3 pt-4 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Add Trusted Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input type="text" placeholder="Contact Name (e.g. Alex)" value={cName} onChange={e => setCName(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none" required />
              <input type="email" placeholder="Email Address (e.g. alex@example.com)" value={cEmail} onChange={e => setCEmail(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none" required />
            </div>
            <input type="tel" placeholder="Phone Number (Optional)" value={cPhone} onChange={e => setCPhone(e.target.value)} className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none" />
            <button type="submit" className="btn-info w-full py-2.5 rounded-xl font-bold text-xs shadow-lg">
              + Add Trusted Contact
            </button>
          </form>
        ) : (
          <p className="text-xs text-amber-400 mt-2 text-center">Maximum limit of 3 trusted contacts reached.</p>
        )}
      </div>

      {/* Emergency Email Dispatch Audit Log */}
      <div className="glass-card p-6 border border-slate-700/80 shadow-xl">
        <h3 className="font-bold text-base text-emerald-400 mb-1 flex items-center gap-2">
          <span>📋</span> Emergency Email Dispatch Audit Log ({sentEmails.length})
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Real-time log of all emergency email notifications dispatched to trusted contacts.
        </p>

        <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
          {sentEmails.map((e, idx) => (
            <div key={idx} className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sr-info">To: {e.contactName} ({e.to})</span>
                <span className="text-[10px] text-slate-500">{new Date(e.deliveredAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-slate-300 font-mono text-[11px] truncate">{e.subject}</p>
              {e.photoUrl && <p className="text-[10px] text-amber-400">📸 Photo Snapshot: {e.photoUrl}</p>}
              {e.audioUrl && <p className="text-[10px] text-emerald-400">🎙️ Audio Clip: {e.audioUrl}</p>}
              {e.shareLink && (
                <a href={e.shareLink} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline text-[11px] block mt-1">
                  🗺️ View Shared Live Tracking Link
                </a>
              )}
            </div>
          ))}
          {sentEmails.length === 0 && (
            <p className="text-xs text-slate-500 italic text-center py-3">No emergency emails dispatched yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
