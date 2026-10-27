"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useIndividualPlan } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { ROLE_KEYS, isTeamManager, teamSlotOf, useCopyInviteLink, useInviteCommands, useTeam } from "@/hooks/team"
import type { InviteSentView } from "@/hooks/team"
import { useSlotLabels } from "@/hooks/slot"
import { TeamInvitesBase } from "./component"
import type { InviteRowView } from "./component"

/** The link just shown for an invitation. */
interface Shown {
    readonly id: string
    readonly email: string
    readonly link: string
    readonly isCopied: boolean
}

/** State values and commands consumed by the connected surface. */
type TeamInvitesControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"team">>
    readonly format: ReturnType<typeof useFormatter>
    readonly member: ReturnType<typeof useMember>
    readonly isIndividual: ReturnType<typeof useIndividualPlan>
    readonly isAllowed: boolean
    readonly team: ReturnType<typeof useTeam>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly commands: ReturnType<typeof useInviteCommands>
    readonly copyToClipboard: ReturnType<typeof useCopyInviteLink>
    readonly busyId: string | undefined
    readonly setBusyId: React.Dispatch<React.SetStateAction<string | undefined>>
    readonly shown: Shown | undefined
    readonly setShown: React.Dispatch<React.SetStateAction<Shown | undefined>>
}

const PLACEHOLDER_ROW: InviteRowView = {
    id: "-",
    email: "-",
    expiry: "-",
    roleLabel: "-",
    isExpired: false,
    isBusy: false,
}

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
    const slotLabels = useSlotLabels()
    const team = useTeam(member?.workspaceId ?? "", isAllowed)
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
        team,
        slotLabels,
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
    const { t, team, slotLabels, commands, busyId, shown, setShown, when, resend, copyLink, revoke } = context
    return {
        props: {
            title: t("invitesTitle"),
            description: t("invitesDesc"),
            resendLabel: t("inviteResend"),
            copyLabel: t("inviteCopy"),
            copiedLabel: t("inviteCopied"),
            revokeLabel: t("inviteRevoke"),
            rotateNote: t("inviteRotateNote"),
            slot: teamSlotOf(
                team,
                team.views.invites.map((invite): InviteRowView => ({
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
            ),
            placeholder: [PLACEHOLDER_ROW],
            slotLabels: slotLabels(t("invitesEmpty")),
        },
        on: {
            retry: team.reload,
            resend: (id) => void resend(id),
            copyLink: (id) => void copyLink(id),
            revoke: (id) => void revoke(id),
            linkCopied: () => setShown((current) => (current === undefined ? current : { ...current, isCopied: true })),
        },
    }
}
