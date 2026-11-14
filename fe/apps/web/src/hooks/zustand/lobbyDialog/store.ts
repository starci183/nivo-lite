"use client"

import { create, type UseBoundStore, type StoreApi } from "zustand"

/** Which lobby dialog is open: rename, leave, the last-owner refusal, delete, or why access is off. */
export type LobbyDialogKind = "rename" | "leave" | "leaveOwner" | "delete" | "reason"

/** The open lobby dialog and the workspace it is about. */
export interface LobbyDialog {
    readonly kind: LobbyDialogKind
    readonly workspaceId: string
}

/** Feature-local state of the workspaces lobby: the one dialog open, shared by the menus that open it and the dialogs that draw it. */
interface LobbyDialogState {
    readonly dialog: LobbyDialog | undefined
    readonly open: (kind: LobbyDialogKind, workspaceId: string) => void
    readonly close: () => void
}

/** The store of the open lobby dialog. */
export const useLobbyDialogStore: UseBoundStore<StoreApi<LobbyDialogState>> = create<LobbyDialogState>((set) => ({
    dialog: undefined,
    open: (kind, workspaceId) => set({ dialog: { kind, workspaceId } }),
    close: () => set({ dialog: undefined }),
}))
