export const getApiUrl = () => import.meta.env.VITE_API_URL || '';

export const getHeaders = (extraHeaders = {}) => {
  const stored = localStorage.getItem('sr_session');
  let token = '';
  if (stored) { try { token = JSON.parse(stored).token; } catch (e) {} }

  // Also check parent token as fallback auth source
  if (!token) {
    const parentToken = localStorage.getItem('sr_parent_token');
    if (parentToken) token = parentToken;
  }

  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...extraHeaders
  };
};

export const apiGet = async (path, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { headers: getHeaders(customHeaders) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiPost = async (path, body, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'POST', headers: getHeaders(customHeaders), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiPut = async (path, body, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'PUT', headers: getHeaders(customHeaders), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export const apiDelete = async (path, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'DELETE', headers: getHeaders(customHeaders) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
};
