"use client"

import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"
import type { TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamPanesCopy = TeamPanesBaseProps["props"]["copy"]

/** How many people and invitations the team has: the one line above the list. */
interface TeamCounts {
    readonly members: number
    readonly invites: number
}

/** The words of the team panes: the page, the list, the filter, the states and the two detail panes. */
export const useTeamPanesCopy = (counts: TeamCounts): TeamPanesCopy => {
    const t = useTranslations("team")
    const p = useTranslations("permissions")
    const pane = usePaneCopy()
    return {
        grid: t("gridLabel"),
        title: t("title"),
        description: t("description"),
        tabsLabel: p("tabsLabel"),
        membersTab: p("tabMembers"),
        permissionsTab: p("tabPermissions"),
        inviteAction: t("formTitle"),
        listTitle: t("membersTitle"),
        listLabel: t("listLabel"),
        detailLabel: t("detailLabel"),
        summary: t("summary", { members: counts.members, invites: counts.invites }),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        clearSearch: pane.clearSearch,
        filterLabel: t("filterLabel"),
        filterAll: t("filterAll"),
        filterMembers: t("filterMembers"),
        filterInvites: t("filterInvites"),
        filterSearch: pane.filterSearch,
        filterNoMatch: pane.filterNoMatch,
        sectionMembers: t("membersTitle"),
        sectionInvites: t("invitesTitle"),
        youLabel: t("you"),
        pickTitle: t("pickTitle"),
        pickBody: t("pickBody"),
        emptyBody: t("emptyBody"),
        errorBody: t("loadFailBody"),
        noMatchTitle: pane.noMatchTitle,
        noMatchBody: pane.noMatchBody,
        back: pane.backToList,
        forbiddenTitle: t("forbiddenTitle"),
        forbiddenBody: t("forbiddenBody"),
        forbiddenAction: t("forbiddenBack"),
        cancelLabel: t("confirmNo"),
        member: {
            roleTitle: t("colRole"),
            roleLabel: t("colRole"),
            lastSignInTerm: t("colLastSignIn"),
            staffTerm: t("staffTerm"),
            accessTitle: t("accessTitle"),
            accessHint: t("accessHint"),
            disableLabel: t("actionDisable"),
            enableLabel: t("actionEnable"),
            removeLabel: t("actionRemove"),
            youLabel: t("you"),
        },
        invite: {
            stateLabel: t("inviteStateWaiting"),
            roleTerm: t("colRole"),
            expiryTerm: t("expiryTerm"),
            staffTerm: t("staffTerm"),
            resendLabel: t("inviteResend"),
            copyLabel: t("inviteCopy"),
            copiedLabel: t("inviteCopied"),
            revokeLabel: t("inviteRevoke"),
            rotateNote: t("inviteRotateNote"),
        },
    }
}
