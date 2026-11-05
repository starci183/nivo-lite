"use client"

import { useTranslations } from "next-intl"
import { useIndividualPlan } from "@/hooks/billing"
import { useMember } from "@/hooks/member"
import { paneGridOf, usePaneCopy, usePanePhone } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { NO_STAFF, useInviteInteraction, useTeamMemberActions } from "@/hooks/team"
import { useTeamInviteDrawer } from "@/hooks/teamInvite"
import type { TeamInviteDrawerState } from "@/hooks/teamInvite"
import { navigation } from "@/modules/i18n"
import { APP_ROUTES, creditsPath } from "@/modules/routes"
import { useTeamInviteDrawerView } from "./useTeamInviteDrawerView"
import { useTeamPanesCopy } from "./useTeamPanesCopy"
import { useTeamPanesData } from "./useTeamPanesData"
import type { TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamConfirmView = NonNullable<TeamPanesBaseProps["props"]["confirm"]>

/** What the commands of the panes need: the state of the panes and the commands behind them. */
interface Handling {
    readonly data: ReturnType<typeof useTeamPanesData>
    readonly actions: ReturnType<typeof useTeamMemberActions>
    readonly drawer: TeamInviteDrawerState
    readonly interaction: ReturnType<typeof useInviteInteraction>
    readonly phone: ReturnType<typeof usePanePhone>
    readonly router: ReturnType<typeof navigation.useRouter>
    readonly moreFilters: (count: number) => string
    /** An invitation waits for its withdrawal to be confirmed, not a person's access. */
    readonly isRevoking: boolean
}

/** The commands of the panes: narrow, open, invite, change a person, act on an invitation, answer the question asked. */
const onOf = (input: Handling): TeamPanesBaseProps["on"] => {
    const { data, actions, drawer, interaction, phone, router } = input
    return {
        retry: data.team.reload,
        setQuery: data.setQuery,
        setFilter: data.setFilter,
        moreFilters: input.moreFilters,
        select: (id) => {
            data.select(id)
            phone.showMain()
        },
        back: phone.showList,
        openInvite: drawer.open,
        closeInvite: drawer.close,
        setInviteEmail: (value) =>
            drawer.form.setValue("email", value, { shouldValidate: drawer.form.formState.isSubmitted }),
        setInviteRole: (value) => {
            if (value === "manager" || value === "staff") drawer.form.setValue("role", value)
        },
        setInviteStaff: (value) => drawer.form.setValue("staffId", value ?? NO_STAFF),
        submitInvite: drawer.submit,
        inviteCopied: drawer.markCopied,
        linkCopied: interaction.linkCopied,
        goTeamPlan: () => router.push(creditsPath()),
        goOffice: () => router.push(APP_ROUTES.chat),
        setRole: (id, role) => {
            if (role === "owner" || role === "manager" || role === "staff") actions.changeRole(id, role)
        },
        enable: actions.enable,
        askDisable: actions.askDisable,
        askRemove: actions.askRemove,
        resend: interaction.resend,
        copyLink: interaction.copyLink,
        askRevoke: interaction.revoke,
        acceptConfirm: input.isRevoking ? interaction.confirmRevoke : actions.acceptConfirm,
        cancelConfirm: input.isRevoking ? interaction.cancelRevoke : actions.cancelConfirm,
    }
}

/** The question the panes ask: withdrawing an invitation when one waits, else removing or disabling a person. */
const confirmOf = (
    revoking: { readonly email: string } | undefined,
    actions: ReturnType<typeof useTeamMemberActions>,
    interaction: ReturnType<typeof useInviteInteraction>,
    t: ReturnType<typeof useTranslations<"team">>,
): TeamConfirmView | undefined => {
    if (revoking !== undefined) {
        return {
            title: t("confirmRevokeTitle", { email: revoking.email }),
            description: t("confirmRevokeBody"),
            confirmLabel: t("inviteRevoke"),
            isPending: interaction.commands.isPending,
        }
    }
    return actions.confirm === undefined ? undefined : { ...actions.confirm, isPending: actions.isPending }
}

/**
 * The whole view of the team panes: reads the team, localizes it and builds the commands. The narrowing, the opened record, the
 * invite drawer and the phone pane live here, so the block only hands the result to its pure half.
 */
export const useTeamPanesView = (): TeamPanesBaseProps => {
    const t = useTranslations("team")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const phone = usePanePhone()
    const member = useMember()
    const isIndividual = useIndividualPlan(member?.workspaceId)
    const interaction = useInviteInteraction()
    const data = useTeamPanesData(interaction)
    const actions = useTeamMemberActions(data.team.views.members)
    const drawer = useTeamInviteDrawer()
    const revoking = data.team.views.invites.find((invite) => invite.id === interaction.revokingId)
    const counts = { members: data.team.views.members.length, invites: data.team.views.invites.length }
    return {
        props: {
            copy: useTeamPanesCopy(counts),
            grid: paneGridOf({ hasList: data.isManager, hasAside: false, phone: phone.phone }),
            access: data.isManager ? "manager" : "staff",
            slot: data.slot,
            labels: { ...slotLabels(t("emptyTitle")), error: t("loadFailTitle") },
            query: data.query,
            filter: data.filter,
            selectedId: data.selectedId,
            confirm: confirmOf(revoking, actions, interaction, t),
            isMemberPending: actions.isPending,
            invite: useTeamInviteDrawerView(drawer, data.team.views, isIndividual),
        },
        on: onOf({
            data,
            actions,
            drawer,
            interaction,
            phone,
            router,
            moreFilters: pane.moreFilters,
            isRevoking: revoking !== undefined,
        }),
    }
}
