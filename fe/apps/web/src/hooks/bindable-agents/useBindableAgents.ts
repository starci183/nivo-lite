"use client"

import { useQueryBindableAgentsSwr } from "@/hooks/swr"

/**
 * Who may be bound to a connection of this provider, read from the back end (the installation decides, never a table here).
 * Pass `undefined` while the provider is not known: the read waits. While it is in flight the data is `undefined`, and the callers
 * join the read to their slot so nothing offers a guessed pair.
 */
export const useBindableAgents = (provider: string | undefined): ReturnType<typeof useQueryBindableAgentsSwr> =>
    useQueryBindableAgentsSwr(provider === undefined ? null : { provider })
