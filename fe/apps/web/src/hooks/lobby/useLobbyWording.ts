"use client"

import { useFormatter, useNow, useTranslations } from "next-intl"
import type { WorkspaceMenuView, WorkspaceTableRowView } from "@/modules/types"
import type { LobbyWorkspace } from "./lobby.shared"

const DAY_MS = 86_400_000

/** The catalog key (`workspacesLobby`) of each role. */
const ROLE_KEYS = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** Midnight, local time, of the day an instant falls on. */
const startOfDay = (time: number): number => new Date(new Date(time).toDateString()).getTime()

/** How the lobby words one workspace row. */
interface LobbyWording {
    /** The row as the table and the phone stack draw it. */
    readonly rowOf: (row: LobbyWorkspace, isBusy: boolean, isCopying: boolean) => WorkspaceTableRowView
}

/** The words of the lobby rows: role, plan and people under the name, when it was last opened, and the ⋯ menu. */
export const useLobbyWording = (): LobbyWording => {
    const t = useTranslations("workspacesLobby")
    const tMenu = useTranslations("workspacesMenu")
    const format = useFormatter()
    const now = useNow().getTime()
    const lastOpenedOf = (row: LobbyWorkspace): string => {
        if (row.state === "new") return t("justNow")
        if (row.lastOpenedAt === null) return t("neverOpened")
        const days = Math.round((startOfDay(now) - startOfDay(new Date(row.lastOpenedAt).getTime())) / DAY_MS)
        if (days <= 0) return t("today")
        if (days === 1) return t("yesterday")
        if (days < 7) return t("daysAgo", { days })
        return format.dateTime(new Date(row.lastOpenedAt), { day: "numeric", month: "numeric" })
    }
    const identityOf = (row: LobbyWorkspace): string =>
        [t(ROLE_KEYS[row.role]), row.planName].filter((part) => part !== null).join(" · ")
    const peopleOf = (row: LobbyWorkspace): string =>
        row.seatLimit === null
            ? t("people", { count: row.memberCount })
            : t("peopleOfLimit", { count: row.memberCount, limit: row.seatLimit })
    const metaOf = (row: LobbyWorkspace): string => {
        if (row.state === "deleted")
            return t("metaDeleted", {
                date: format.dateTime(new Date(row.restoreBefore ?? now), { day: "numeric", month: "numeric" }),
            })
        if (row.state === "disabled") return [t(ROLE_KEYS[row.role]), t("metaDisabled")].join(" · ")
        if (row.state === "pending") return [identityOf(row), t("metaPending")].join(" · ")
        return [identityOf(row), peopleOf(row)].join(" · ")
    }
    const menuOf = (row: LobbyWorkspace, isCopying: boolean): WorkspaceMenuView => ({
        menuLabel: tMenu("menu"),
        openLabel: tMenu("open"),
        billingLabel: tMenu("billing"),
        renameLabel: tMenu("rename"),
        copyLinkLabel: tMenu("copyLink"),
        leaveLabel: tMenu("leave"),
        deleteLabel: tMenu("delete"),
        deleteNote: tMenu("deleteNote"),
        canRename: row.canManage,
        canInvite: row.canManage && !isCopying,
        canLeave: row.state !== "deleted",
        canDelete: row.state !== "disabled" && row.state !== "deleted" && row.role === "owner",
    })
    return {
        rowOf: (row, isBusy, isCopying) => ({
            id: row.id,
            name: row.name,
            status: row.state,
            meta: metaOf(row),
            lastOpened: lastOpenedOf(row),
            isPrimary: row.isPrimary,
            isBusy,
            menu: menuOf(row, isCopying),
            identity: identityOf(row),
        }),
    }
}
