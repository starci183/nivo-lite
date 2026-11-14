"use client"

import { create, type UseBoundStore, type StoreApi } from "zustand"

/** Feature-local state of the workspaces lobby: the workspace the person joined from a pending invitation in this visit. */
interface LobbyJoinedState {
    readonly joinedId: string | undefined
    readonly setJoinedId: (id: string | undefined) => void
}

/** The store of the workspace just joined from the lobby: its row lands on top, marked new, with the primary action. */
export const useLobbyJoinedStore: UseBoundStore<StoreApi<LobbyJoinedState>> = create<LobbyJoinedState>((set) => ({
    joinedId: undefined,
    setJoinedId: (id) => set({ joinedId: id }),
}))
