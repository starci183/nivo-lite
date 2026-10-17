"use client"

import type { Shown, TeamInvitesControllerInput } from "./component"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useIndividualPlan } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { ROLE_KEYS, isTeamManager, useCopyInviteLink, useInviteCommands, useTeam } from "@/hooks/team"
import type { InviteSentView } from "@/hooks/team"
import { TeamInvitesBase } from "./component"

/** The link just issued for one invitation. */

/** The connected invitations list: resend, copy a fresh link (which replaces the old one) and revoke, through the back end GraphQL API. */
const createTeamInvitesState = (input: TeamInvitesControllerInput) => {
    const { format, commands, copyToClipboard, setBusyId, setShown } = input

    const when = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })

    const run = async <R,>(id: string, job: () => Promise<R | undefined>, after: (value: R) => void) => {
        setBusyId(id)
        const result = await job()
        setBusyId(undefined)
        if (result !== undefined) after(result)
    }

    const copy = async (link: string): Promise<void> => {
        if (await copyToClipboard(link))
            setShown((current) => (current === undefined ? current : { ...current, isCopied: true }))
    }

    const resend = (id: string) =>
        run(
            id,
            () => commands.resend(id),
            (result: InviteSentView) => {
                setShown({ id, email: result.email, link: result.link, isCopied: false })
            },
        )
    const copyLink = (id: string) =>
        run(
            id,
            () => commands.copyLink(id),
            (result: InviteSentView) => {
                setShown({ id, email: result.email, link: result.link, isCopied: false })
                void copy(result.link)
            },
        )
    const revoke = async (id: string) => {
        setBusyId(id)
        const revoked = await commands.revoke(id)
        setBusyId(undefined)
        if (revoked) setShown(undefined)
    }
    return { ...input, when, resend, copyLink, revoke }
}

/** Connects the workspace state and commands to the visual surface. */
export const TeamInvites = () => {
    const t = useTranslations("team")
    const format = useFormatter()
    const member = useMember()
    const isIndividual = useIndividualPlan(member?.workspaceId)
    const isAllowed = member !== null && isTeamManager(member.role) && !isIndividual
    const { views, isLoading } = useTeam(member?.workspaceId ?? "", isAllowed)
    const commands = useInviteCommands()
    const copyToClipboard = useCopyInviteLink()
    const [busyId, setBusyId] = useState<string>()
    const [shown, setShown] = useState<Shown>()
    const context = createTeamInvitesState({
        t,
        format,
        member,
        isIndividual,
        isAllowed,
        views,
        isLoading,
        commands,
        copyToClipboard,
        busyId,
        setBusyId,
        shown,
        setShown,
    })

    if (!isAllowed) return null
    return <TeamInvitesBase {...createTeamInvitesView(context)} />
}

const createTeamInvitesView = (
    context: ReturnType<typeof createTeamInvitesState>,
): React.ComponentProps<typeof TeamInvitesBase> => {
    const { t, views, isLoading, commands, busyId, shown, setShown, when, resend, copyLink, revoke } = context
    return {
        props: {
            title: t("invitesTitle"),
            description: t("invitesDesc"),
            emptyLabel: t("invitesEmpty"),
            failTitle: t("errGeneric"),
            resendLabel: t("inviteResend"),
            copyLabel: t("inviteCopy"),
            copiedLabel: t("inviteCopied"),
            revokeLabel: t("inviteRevoke"),
            rotateNote: t("inviteRotateNote"),
            rows: (isLoading ? [] : views.invites).map((invite) => ({
                id: invite.id,
                email: invite.email,
                expiry: t(invite.isExpired ? "inviteExpired" : "inviteExpires", { date: when(invite.expiresAt) }),
                staffNote: invite.staffName === null ? undefined : t("inviteStaffFor", { name: invite.staffName }),
                roleLabel: t(ROLE_KEYS[invite.role]),
                isExpired: invite.isExpired,
                isBusy: commands.isPending && busyId === invite.id,
                link:
                    shown?.id === invite.id
                        ? {
                              label: t("inviteLinkLabel", { email: shown.email }),
                              value: shown.link,
                              isCopied: shown.isCopied,
                          }
                        : undefined,
            })),
            isSkeleton: isLoading,
        },
        on: {
            resend: (id) => void resend(id),
            copyLink: (id) => void copyLink(id),
            revoke: (id) => void revoke(id),
            linkCopied: () => setShown((current) => (current === undefined ? current : { ...current, isCopied: true })),
        },
    }
}
