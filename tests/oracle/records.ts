// Own-property access for records keyed by branch names and file paths. Names such as "constructor"
// or "__proto__" are valid in git, so plain `record[key]` reads and writes would go wrong.

export function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function put<T>(record: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(record, key, { value, writable: true, enumerable: true, configurable: true });
}
