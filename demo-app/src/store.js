export function createStore() {
  const rows = [];
  return {
    insert(record) {
      const saved = { id: rows.length + 1, ...record };
      rows.push(saved);
      return saved;
    },
    all: () => rows.slice(),
  };
}
