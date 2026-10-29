/** Builds a factory of entity instances: the defaults first, the overrides of one call last. */
export const entityOf =
    <E extends object>(Entity: new () => E, defaults: Partial<E>) =>
    (overrides: Partial<E> = {}): E =>
        Object.assign(new Entity(), defaults, overrides)
