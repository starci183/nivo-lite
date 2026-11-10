import { useSyncExternalStore } from "react"

/**
 * FAKE SOURCE helper: a tiny in-memory store that stands in for a server read until the real GraphQL exists. It is read by the
 * `fake*.ts` sources of this folder only; nothing else imports it.
 */
export interface FakeStore<State> {
    readonly get: () => State
    readonly set: (next: State) => void
    readonly use: () => State
}

/** Makes a store holding `initial`. */
export const makeFakeStore = <State>(initial: State): FakeStore<State> => {
    let state = initial
    const listeners = new Set<() => void>()
    const subscribe = (listener: () => void): (() => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
    }
    const get = (): State => state
    return {
        get,
        set: (next) => {
            state = next
            listeners.forEach((listener) => listener())
        },
        use: () => useSyncExternalStore(subscribe, get, get),
    }
}
