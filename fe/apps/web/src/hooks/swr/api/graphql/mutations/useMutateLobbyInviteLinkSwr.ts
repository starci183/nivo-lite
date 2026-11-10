"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import { mutateCopyInviteLink } from "@/modules/api/graphql/mutations/mutation-copy-invite-link"
import { queryWorkspaceInvites } from "@/modules/api/graphql/queries/query-workspace-invites"
import { answeredData } from "@/hooks/workspaceread"
import { GraphQLHeadersKey } from "@/modules/api"

/** The SWR key of copying a workspace's invitation link from the lobby. */
export const MUTATE_LOBBY_INVITE_LINK_SWR_KEY = "MUTATE_LOBBY_INVITE_LINK_SWR"

/** A fresh link to the newest pending invitation of a workspace, with its address and when it stops working; null when none is pending. */
export interface LobbyInviteLink {
    readonly link: string
    readonly email: string
    readonly expiresAt: string
}

/** The workspace whose invitation link the lobby copies. */
interface TriggerArg {
    readonly arg: { readonly workspaceId: string }
}

/**
 * Copies a workspace's invitation link from the lobby, which has no workspace in its address: reads the workspace's pending invitations
 * (`workspaceInvites`), gives the newest a fresh link (`copyInviteLink`; the earlier link of that invitation stops working) and reads
 * its new expiry back. Answers null when the workspace has no pending invitation.
 */
export const useMutateLobbyInviteLinkSwr = (): SWRMutationResponse<
    LobbyInviteLink | null,
    Error,
    typeof MUTATE_LOBBY_INVITE_LINK_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(MUTATE_LOBBY_INVITE_LINK_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const headers = { [GraphQLHeadersKey.XWorkspaceId]: arg.workspaceId }
        const pending = answeredData(await queryWorkspaceInvites({ headers }), MUTATE_LOBBY_INVITE_LINK_SWR_KEY)
        const newest = pending.workspaceInvites[0]
        if (newest === undefined) return null
        const copied = answeredData(
            await mutateCopyInviteLink({ request: { inviteId: newest.id }, headers }),
            MUTATE_LOBBY_INVITE_LINK_SWR_KEY,
        ).copyInviteLink
        const after = answeredData(await queryWorkspaceInvites({ headers }), MUTATE_LOBBY_INVITE_LINK_SWR_KEY)
        const renewed = after.workspaceInvites.find((invite) => invite.id === newest.id)
        return { link: copied.link, email: copied.email, expiresAt: renewed?.expiresAt ?? newest.expiresAt }
    })
