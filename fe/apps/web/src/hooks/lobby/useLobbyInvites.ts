"use client"

import { useNow, useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import {
    QUERY_MY_PENDING_INVITES_SWR_KEY,
    QUERY_MY_WORKSPACES_SWR_KEY,
    useMutateDeclineInviteSwr,
    useMutateJoinInviteSwr,
    useQueryMyPendingInvitesSwr,
} from "@/hooks/swr"
import { useLobbyJoinedStore } from "@/hooks/zustand/lobbyJoined"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { matchesSwrKey } from "@/modules/utils"
import { mutate } from "@/modules/viewer-cache"
import { lobbyInvitesOf, type LobbyInvite } from "./lobby.shared"

/** The invitations addressed to the person and the two answers to each. */
export interface LobbyInvites {
    readonly invites: ReadonlyArray<LobbyInvite>
    readonly isLoading: boolean
    /** Joins the workspace: its row lands on top of the list as new, and a toast offers to open it. */
    readonly accept: (invite: LobbyInvite) => Promise<boolean>
    /** Declines the invitation; its link stops working (there is no undo). */
    readonly decline: (invite: LobbyInvite) => Promise<boolean>
    /** The invitation being answered, while it is. */
    readonly busyId: string | undefined
}

/** Reads the invitations and the workspaces again after an answer. */
const refreshAfterAnswer = async (): Promise<void> => {
    await Promise.all([
        mutate(matchesSwrKey(QUERY_MY_PENDING_INVITES_SWR_KEY)),
        mutate(matchesSwrKey(QUERY_MY_WORKSPACES_SWR_KEY)),
    ])
}

/** The pending invitations to the signed-in person's email, with join and decline through the back end, toasted. */
export const useLobbyInvites = (): LobbyInvites => {
    const t = useTranslations("workspacesInvites")
    const router = navigation.useRouter()
    const runGraphQL = useGraphQLWithToast()
    const read = useQueryMyPendingInvitesSwr()
    const joining = useMutateJoinInviteSwr()
    const declining = useMutateDeclineInviteSwr()
    const setJoinedId = useLobbyJoinedStore((state) => state.setJoinedId)
    const [busyId, setBusyId] = useState<string | undefined>(undefined)
    const now = useNow().getTime()
    const accept = useCallback(
        async (invite: LobbyInvite): Promise<boolean> => {
            setBusyId(invite.id)
            const joined = await runGraphQL(() => joining.trigger({ inviteId: invite.id }), { showSuccessToast: false })
            setBusyId(undefined)
            if (joined === undefined) return false
            setJoinedId(joined.workspaceId)
            await refreshAfterAnswer()
            toast.success(t("joinedToast", { workspace: invite.workspaceName }), {
                actionProps: {
                    children: t("joinedOpen"),
                    onPress: () => router.push(workspaceHref(joined.workspaceId, APP_ROUTES.workspaceHome)),
                },
            })
            return true
        },
        [runGraphQL, joining, setJoinedId, router, t],
    )
    const decline = useCallback(
        async (invite: LobbyInvite): Promise<boolean> => {
            setBusyId(invite.id)
            const done = await runGraphQL(() => declining.trigger({ inviteId: invite.id }), {
                successMessage: t("declinedToast", { workspace: invite.workspaceName }),
            })
            setBusyId(undefined)
            if (done === undefined) return false
            await refreshAfterAnswer()
            return true
        },
        [runGraphQL, declining, t],
    )
    return {
        invites: lobbyInvitesOf(read.data ?? [], now),
        isLoading: read.isLoading,
        accept,
        decline,
        busyId,
    }
}
