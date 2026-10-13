"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import {
    useMutateCopyInviteLinkSwr,
    useMutateCreateInviteSwr,
    useMutateResendInviteSwr,
    useMutateRevokeInviteSwr,
} from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { inviteSentOf, refreshTeam } from "./team.shared"
import type { InviteSentView } from "./team.shared"

const SENT_KEYS = { invited: "sentEmail", existing: "sentNoticeExisting", none: "sentNoEmail" } as const

/** What a person types to invite someone. */
export interface InviteInput {
    readonly email: string
    readonly role: "manager" | "staff"
    /** The staff row the account will be, or null. */
    readonly staffId: string | null
}

/** The invitation commands. A failure was toasted with the back end words and answers `undefined` (`false` for revoke). */
export interface InviteCommands {
    readonly create: (input: InviteInput) => Promise<InviteSentView | undefined>
    readonly resend: (inviteId: string) => Promise<InviteSentView | undefined>
    readonly copyLink: (inviteId: string) => Promise<InviteSentView | undefined>
    readonly revoke: (inviteId: string) => Promise<boolean>
    readonly isPending: boolean
}

/** The invitation commands of the active workspace through the back end, toasted, with the team revalidated on success. */
export const useInviteCommands = (): InviteCommands => {
    const t = useTranslations("team")
    const tToast = useTranslations("toast")
    const runGraphQL = useGraphQLWithToast()
    const creation = useMutateCreateInviteSwr()
    const resending = useMutateResendInviteSwr()
    const linking = useMutateCopyInviteLinkSwr()
    const revoking = useMutateRevokeInviteSwr()
    const create = useCallback(
        async (input: InviteInput): Promise<InviteSentView | undefined> => {
            const result = await runGraphQL(
                () => creation.trigger({ email: input.email, role: input.role, staffId: input.staffId }),
                { showSuccessToast: false },
            )
            if (result === undefined) return undefined
            const sent = inviteSentOf(result)
            toast.success(tToast("successTitle"), {
                description: t(SENT_KEYS[sent.delivery], { email: sent.email }),
            })
            await refreshTeam()
            return sent
        },
        [runGraphQL, creation, t, tToast],
    )
    const resend = useCallback(
        async (inviteId: string): Promise<InviteSentView | undefined> => {
            const result = await runGraphQL(() => resending.trigger({ inviteId }), { showSuccessToast: false })
            if (result === undefined) return undefined
            const sent = inviteSentOf(result)
            toast.success(tToast("successTitle"), { description: t("inviteResent", { email: sent.email }) })
            await refreshTeam()
            return sent
        },
        [runGraphQL, resending, t, tToast],
    )
    const copyLink = useCallback(
        async (inviteId: string): Promise<InviteSentView | undefined> => {
            const result = await runGraphQL(() => linking.trigger({ inviteId }), { showSuccessToast: false })
            if (result === undefined) return undefined
            await refreshTeam()
            return inviteSentOf(result)
        },
        [runGraphQL, linking],
    )
    const revoke = useCallback(
        async (inviteId: string): Promise<boolean> => {
            const done = await runGraphQL(() => revoking.trigger({ inviteId }), { successMessage: t("inviteRevoked") })
            if (done === undefined) return false
            await refreshTeam()
            return true
        },
        [runGraphQL, revoking, t],
    )
    return {
        create,
        resend,
        copyLink,
        revoke,
        isPending: creation.isMutating || resending.isMutating || linking.isMutating || revoking.isMutating,
    }
}
