"use client"

import { useQueryConnectionsSwr } from "@/hooks/swr"

/** The names the page words ids with: which connection (account of a channel) an identity lives on. */
export interface ContactNames {
    /** The name of a connection (an account of a channel) by its id, or null when the read has not named it (yet). */
    readonly account: (id: string) => string | null
}

/**
 * Reads what turns the connection ids on a person's identities into names. A name still being read is null: the row falls back to
 * the channel's brand, never to an id. (The captions of the conversation and the labels of the work are named by the server.)
 */
export const useContactNames = (): ContactNames => {
    const connections = useQueryConnectionsSwr()
    return { account: (id) => connections.data?.find((connection) => connection.id === id)?.name ?? null }
}
