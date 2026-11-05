/** The value a record holds under its OWN key, so a name like `constructor` or `__proto__` from a request never reaches the prototype. */
export const ownEntry = <T>(record: Readonly<Record<string, T>>, key: string): T | undefined =>
    Object.hasOwn(record, key) ? record[key] : undefined
