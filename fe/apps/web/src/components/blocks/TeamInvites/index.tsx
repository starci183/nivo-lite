"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useIndividualPlan } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { ROLE_KEYS, isTeamManager, teamSlotOf, useInviteInteraction, useTeam } from "@/hooks/team"
import { useSlotLabels } from "@/hooks/slot"
import { TeamInvitesBase } from "./component"
import type { TeamInvitesBaseProps } from "./component"
import type { InviteRowView } from "@/modules/team"

/** Read data and interaction consumed when the connected owner resolves its copy. */
interface TeamInvitesViewInput {
    readonly t: ReturnType<typeof useTranslations<"team">>
    readonly format: ReturnType<typeof useFormatter>
    readonly team: ReturnType<typeof useTeam>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly interaction: ReturnType<typeof useInviteInteraction>
}

const PLACEHOLDER_ROW: InviteRowView = {
    id: "-",
    email: "-",
    expiry: "-",
    roleLabel: "-",
    isExpired: false,
    isBusy: false,
    pendingAction: null,
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
    const interaction = useInviteInteraction()

    if (!isAllowed) return null
    return <TeamInvitesBase {...createTeamInvitesView({ t, format, team, slotLabels, interaction })} />
}

const createTeamInvitesView = (context: TeamInvitesViewInput): TeamInvitesBaseProps => {
    const { t, format, team, slotLabels, interaction } = context
    const { commands, busyId, busyAction, shown, revokingId } = interaction
    const when = (iso: string): string => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" })
    const target = team.views.invites.find((invite) => invite.id === revokingId)
    return {
        props: {
            title: t("invitesTitle"),
            description: t("invitesDesc"),
            resendLabel: t("inviteResend"),
            copyLabel: t("inviteCopy"),
            copiedLabel: t("inviteCopied"),
            revokeLabel: t("inviteRevoke"),
            cancelLabel: t("confirmNo"),
            confirm:
                target === undefined
                    ? undefined
                    : {
                          email: target.email,
                          isPending: commands.isPending && busyId === target.id && busyAction === "revoke",
                      },
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
                    pendingAction: commands.isPending && busyId === invite.id ? busyAction : null,
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
            resend: interaction.resend,
            copyLink: interaction.copyLink,
            revoke: interaction.revoke,
            confirmRevoke: interaction.confirmRevoke,
            cancelRevoke: interaction.cancelRevoke,
            linkCopied: interaction.linkCopied,
        },
    }
}
