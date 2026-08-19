export const formatTime = (ms) => {
  if (ms < 0) return '00:00';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins > 60) return `${Math.floor(mins/60)}h ${mins%60}m`;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatDate = (isoString) => new Date(isoString).toLocaleString();

export const formatDistance = (meters) => {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
};

export const getStatusIcon = (status) => ({ safe: '✅', warning: '⚠️', alert: '🚨' }[status] || 'ℹ️');
export const getStatusLabel = (status) => status.charAt(0).toUpperCase() + status.slice(1);
