"use client"

import { useTranslations } from "next-intl"
import type { StoredRule } from "@/modules/authority"
import type { PermissionDraft } from "@/modules/permissions"

/** Every fixed word of the rule drawer, worded for the rule being changed and for who is looking. */
export const usePermissionDrawerCopy = () => {
    const t = useTranslations("permissions")
    const g = useTranslations("governance")
    return (rule: StoredRule, draft: PermissionDraft, isOwner: boolean) => ({
        drawerDesc: t("drawerDesc", { department: g(`dept_${rule.department}`) }),
        close: t("close"),
        agentsLabel: t("agentsLabel"),
        agentsHint: t("agentsHint"),
        strategyLabel: t("strategyLabel"),
        unitLabel: t("unitLabel"),
        autoMaxLabel: t("autoMaxLabel"),
        askMaxLabel: t("askMaxLabel"),
        sliderLabel: t("sliderLabel"),
        bandsInvalid: t("bandsInvalid"),
        groupLabel: t("groupLabel"),
        rolesLabel: t("rolesLabel"),
        roomsLabel: t("roomsLabel"),
        roomsNone: t("roomsNone"),
        membersLabel: t("membersLabel"),
        membersHint: t("membersHint"),
        policyLabel: t("policyLabel"),
        timeoutLabel: t("timeoutLabel"),
        timeoutNote: t("timeoutNote", { minutes: draft.timeoutMinutes }),
        grantsLabel: t("grantsLabel"),
        grantsNote: isOwner ? t("grantsHint") : t("grantsOwnerOnly"),
        ownerAlways: t("ownerAlways"),
        save: t("save"),
        cancel: t("cancel"),
    })
}
