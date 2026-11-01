import type { Arguments, MutatorCallback, MutatorOptions, ScopedMutator } from "swr"

/** A key, a key list, or a test over every cached key. */
type CacheTarget = Arguments | ((key?: Arguments) => boolean)

/** The cache of the signed-in viewer: each viewer has its own, so the mutate SWR exports, bound to its default cache, reaches none of them. */
let viewerMutate: ScopedMutator | undefined

/** Binds the writes below to the cache of the viewer now on screen; called by the provider of that cache. */
export const bindViewerCache = (mutator: ScopedMutator): void => {
    viewerMutate = mutator
}

/** Refreshes or writes entries of the viewer's cache, the way SWR's own `mutate` does for its default cache. */
export const mutate = async <Data = unknown>(
    target: CacheTarget,
    data?: Data | Promise<Data> | MutatorCallback<Data>,
    options?: boolean | MutatorOptions<Data>,
): Promise<Data | undefined> => {
    if (viewerMutate === undefined) return undefined
    if (typeof target === "function") return viewerMutate<Data>(target, data, options)
    return viewerMutate<Data>(target, data, options)
}
