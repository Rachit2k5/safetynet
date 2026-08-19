export const getApiUrl = () => import.meta.env.VITE_API_URL || '';

export const getHeaders = () => {
  const stored = localStorage.getItem('sr_session');
  let token = '';
  if (stored) { try { token = JSON.parse(stored).token; } catch (e) {} }
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const apiGet = async (path) => {
  const res = await fetch(`${getApiUrl()}${path}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiPost = async (path, body) => {
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiPut = async (path, body) => {
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiDelete = async (path) => {
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
