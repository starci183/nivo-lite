"use client"

import { useTranslations } from "next-intl"
import type { PermissionDraft } from "@/modules/permissions"

/** Every fixed word of the rule drawer, worded for the rule being changed and for who is looking. */
export const usePermissionDrawerCopy = () => {
    const t = useTranslations("permissions")
    return (
        draft: PermissionDraft,
        isOwner: boolean,
    ): {
        agentsLabel: string
        agentsHint: string
        strategyLabel: string
        unitLabel: string
        autoMaxLabel: string
        askMaxLabel: string
        sliderLabel: string
        bandsInvalid: string
        groupLabel: string
        rolesLabel: string
        roomsLabel: string
        roomsNone: string
        membersLabel: string
        membersHint: string
        policyLabel: string
        timeoutLabel: string
        timeoutNote: string
        grantsLabel: string
        grantsNote: string
        ownerAlways: string
        save: string
        cancel: string
    } => ({
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
