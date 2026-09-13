// Persistence boundary for the browser build.
// Future production adapters can replace this without touching UI/domain code.
export function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function storageSet(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}

export function storageRemove(key) {
  try { localStorage.removeItem(key); return true; } catch { return false; }
}
