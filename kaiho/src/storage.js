export function createStorage(key) {
  function save(data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  }

  return { save, load };
}
