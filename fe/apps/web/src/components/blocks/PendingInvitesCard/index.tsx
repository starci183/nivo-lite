"use client"

import { useTranslations } from "next-intl"
import { useLobbyInvites, useLobbyWide } from "@/hooks/lobby"
import type { LobbyInvite } from "@/hooks/lobby"
import type { PendingInviteView } from "@/modules/types"
import { PendingInvitesCardBase } from "./component"

/** Where the page puts the card: in the rail beside the table, or above the stacked rows on a phone. */
interface PendingInvitesCardProps {
    readonly placement: "rail" | "main"
}

/** The connected pending-invitations card: the invitations to the signed-in email, hidden when there are none. */
export const PendingInvitesCard = (props: PendingInvitesCardProps) => {
    const t = useTranslations("workspacesInvites")
    const tLobby = useTranslations("workspacesLobby")
    const isWide = useLobbyWide()
    const lobby = useLobbyInvites()
    if (isWide !== (props.placement === "rail") || lobby.invites.length === 0) return null
    const find = (id: string): LobbyInvite | undefined => lobby.invites.find((invite) => invite.id === id)
    const views: ReadonlyArray<PendingInviteView> = lobby.invites.map((invite) => ({
        id: invite.id,
        workspaceName: invite.workspaceName,
        inviterName: invite.inviterName ?? tLobby("someone"),
        roleLabel: tLobby(invite.role === "manager" ? "roleManager" : "roleStaff"),
        expiresInDays: invite.expiresInDays,
    }))
    return (
        <PendingInvitesCardBase
            props={{
                label: t("title"),
                acceptLabel: t("accept"),
                declineLabel: t("decline"),
                invites: views,
                pendingId: lobby.busyId,
                lines: Object.fromEntries(
                    views.map((invite) => [
                        invite.id,
                        t("line", { inviter: invite.inviterName, role: invite.roleLabel, days: invite.expiresInDays }),
                    ]),
                ),
            }}
            on={{
                accept: (id) => {
                    const invite = find(id)
                    if (invite !== undefined) void lobby.accept(invite)
                },
                decline: (id) => {
                    const invite = find(id)
                    if (invite !== undefined) void lobby.decline(invite)
                },
            }}
        />
    )
}
