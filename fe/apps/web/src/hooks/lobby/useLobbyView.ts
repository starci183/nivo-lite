"use client"

import { mapSlot } from "@/hooks/slot"
import { useOpenWorkspace } from "@/hooks/workspaces"
import { useWorkspaceOpenStore } from "@/hooks/zustand/workspaceOpen"
import { useLobbyDialogStore } from "@/hooks/zustand/lobbyDialog"
import { navigation } from "@/modules/i18n"
import { creditsPath, workspaceHref, workspacePaymentPath } from "@/modules/routes"
import type { DataSlot, WorkspaceMenuCommand, WorkspacesTableData } from "@/modules/types"
import type { LobbyWorkspace } from "./lobby.shared"
import { useLobbyCommands } from "./useLobbyCommands"
import { useLobbyWording } from "./useLobbyWording"
import { useLobbyWorkspaces } from "./useLobbyWorkspaces"

/** What the list containers draw: the rows as a slot (each with its menu), the row action, and the menu commands. */
interface LobbyView {
    readonly slot: DataSlot<WorkspacesTableData>
    readonly on: {
        readonly open: (id: string) => void
        readonly pay: (id: string) => void
        readonly showReason: (id: string) => void
        readonly restore: (id: string) => void
        readonly retry: () => void
        readonly command: (id: string, command: WorkspaceMenuCommand) => void
    }
}

/**
 * The lobby list as the table and the phone stack draw it: each row worded with its ⋯ menu, the row action by status, and the menu
 * commands (rename, leave and delete open their dialog through the lobby dialog store; the sole owner's leave opens the refusal).
 */
export const useLobbyView = (): LobbyView => {
    const router = navigation.useRouter()
    const lobby = useLobbyWorkspaces()
    const wording = useLobbyWording()
    const commands = useLobbyCommands()
    const { open } = useOpenWorkspace()
    const openingId = useWorkspaceOpenStore((state) => state.openingId)
    const openDialog = useLobbyDialogStore((state) => state.open)
    const find = (id: string): LobbyWorkspace | undefined => lobby.rows.find((row) => row.id === id)
    const openRow = (id: string) => {
        const row = find(id)
        if (row === undefined) return
        open({ id: row.id, name: row.name, role: row.role, state: row.state === "pending" ? "pending" : "active" })
    }
    const actions: Readonly<Record<WorkspaceMenuCommand, (id: string) => void>> = {
        open: openRow,
        billing: (id) => router.push(workspaceHref(id, creditsPath())),
        rename: (id) => openDialog("rename", id),
        copyLink: (id) => {
            const row = find(id)
            if (row !== undefined) void commands.copyLink(row)
        },
        leave: (id) => openDialog(find(id)?.isSoleOwner === true ? "leaveOwner" : "leave", id),
        delete: (id) => openDialog("delete", id),
    }
    return {
        slot: mapSlot(lobby.slot, (rows) => ({
            rows: rows.map((row) => wording.rowOf(row, openingId === row.id, commands.isCopying)),
        })),
        on: {
            open: openRow,
            pay: (id) => router.push(workspacePaymentPath(id)),
            showReason: (id) => openDialog("reason", id),
            restore: (id) => {
                const row = find(id)
                if (row !== undefined) void commands.restore(row)
            },
            retry: lobby.reload,
            command: (id, command) => actions[command](id),
        },
    }
}
