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

/**
 * Parse API error response and throw a proper error object with .detail
 */
const handleApiError = async (res) => {
  let errorDetail = `Server error (${res.status})`;
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      errorDetail = json.detail || json.message || json.error || text;
    } catch (e) {
      errorDetail = text || errorDetail;
    }
  } catch (e) {}
  
  const err = new Error(errorDetail);
  err.detail = errorDetail;
  err.status = res.status;
  throw err;
};

export const apiGet = async (path, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { headers: getHeaders(customHeaders) });
  if (!res.ok) await handleApiError(res);
  return res.json();
};

export const apiPost = async (path, body, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'POST', headers: getHeaders(customHeaders), body: JSON.stringify(body) });
  if (!res.ok) await handleApiError(res);
  return res.json();
};

export const apiPut = async (path, body, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'PUT', headers: getHeaders(customHeaders), body: JSON.stringify(body) });
  if (!res.ok) await handleApiError(res);
  return res.json();
};

export const apiDelete = async (path, options = {}) => {
  const customHeaders = options?.headers || {};
  const res = await fetch(`${getApiUrl()}${path}`, { method: 'DELETE', headers: getHeaders(customHeaders) });
  if (!res.ok) await handleApiError(res);
  return res.json();
};
