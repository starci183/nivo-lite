"use client"

import { create } from "zustand"
import type { UseBoundStore, StoreApi } from "zustand"

/** Feature-local state of the workspace list: which card is being opened right now. */
interface WorkspaceOpenState {
    readonly openingId: string | undefined
    readonly setOpeningId: (id: string | undefined) => void
}

/** The store of which workspace card is being opened. */
export const useWorkspaceOpenStore: UseBoundStore<StoreApi<WorkspaceOpenState>> = create<WorkspaceOpenState>((set) => ({
    openingId: undefined,
    setOpeningId: (id) => set({ openingId: id }),
}))
