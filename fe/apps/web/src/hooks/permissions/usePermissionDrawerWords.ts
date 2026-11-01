"use client"

import { useTranslations } from "next-intl"
import { APPROVER_ROLES, POLICIES, UNITS } from "@/modules/authority"
import type { ApprovalPolicy, ApproverRole, RuleUnit, StoredRule } from "@/modules/authority"
import { SLIDER_MAX, TIMEOUT_CHOICES } from "@/modules/permissions"
import type { PermissionDraft } from "@/modules/permissions"
import { useBoundFormatter } from "./useBoundFormatter"
import { usePermissionDrawerCopy } from "./usePermissionDrawerCopy"
import { actionWordOf } from "@/hooks/actionWord"

/** What the words of the drawer depend on. */
interface WordsInput {
    readonly rule: StoredRule
    readonly draft: PermissionDraft
    /** Only the owner hands out approval limits. */
    readonly isOwner: boolean
}

/** Every fixed word and list of the rule drawer, resolved against the rule being changed. */
export const usePermissionDrawerWords = () => {
    const t = useTranslations("permissions")
    const g = useTranslations("governance")
    const bound = useBoundFormatter()
    const copyOf = usePermissionDrawerCopy()
    const roleLabels: Readonly<Record<ApproverRole, string>> = {
        owner: t("roleOwner"),
        manager: t("roleManager"),
        staff: t("roleStaff"),
    }
    const policyLabels: Readonly<Record<ApprovalPolicy, string>> = {
        any: t("policyAny"),
        all: t("policyAll"),
        sequential: t("policySequential"),
    }
    const unitLabels: Readonly<Record<RuleUnit, string>> = {
        vnd: t("unitVnd"),
        percent: t("unitPercent"),
        count: t("unitCount"),
    }

    const legendOf = (draft: PermissionDraft) => {
        const auto = Number.isFinite(draft.autoMax) ? draft.autoMax : null
        const ask = Number.isFinite(draft.askMax) ? draft.askMax : null
        const shown = (value: number): string => bound(value, draft.unit)
        const askUpTo =
            auto === null
                ? t("legendAskUpTo", { max: shown(ask ?? 0) })
                : t("legendAsk", { from: shown(auto), to: shown(ask ?? 0) })
        return {
            auto: auto === null ? t("legendAutoNone") : t("legendAuto", { max: shown(auto) }),
            ask: ask === null ? t("legendAskOpen") : askUpTo,
            never: ask === null ? t("legendNeverNone") : t("legendNever", { above: shown(ask) }),
        }
    }

    const viewOf = (input: WordsInput) => ({
        title: actionWordOf(g, input.rule.action),
        copy: copyOf(input.rule, input.draft, input.isOwner),
        legend: legendOf(input.draft),
        sliderMax: SLIDER_MAX[input.draft.unit],
        strategyOptions: [
            { id: "auto", label: g("mode_auto") },
            { id: "bands", label: t("strategyBands") },
            { id: "ask", label: g("mode_ask") },
            { id: "never", label: g("mode_never") },
        ],
        roleOptions: APPROVER_ROLES.map((role) => ({ id: role, label: roleLabels[role] })),
        policyOptions: POLICIES.map((policy) => ({ id: policy, label: policyLabels[policy] })),
        unitOptions: UNITS.map((unit) => ({ id: unit, label: unitLabels[unit] })),
        timeoutOptions: TIMEOUT_CHOICES.map((minutes) => ({
            id: String(minutes),
            label: t("timeoutMinutes", { minutes }),
        })),
    })

    return { viewOf }
}
