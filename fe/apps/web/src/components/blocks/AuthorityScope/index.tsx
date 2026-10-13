"use client"

import { useTranslations } from "next-intl"
import {
    fromField,
    hasAmountLimit,
    authorityModeOf,
    modesFor,
    ruleKey,
    ruleChanges,
    toField,
    useAuthoritySection,
    useInstanceNames,
    useSaveAuthorityRules,
    visibleGroups,
} from "@/hooks/authority"
import { useAuthorityScopeForm } from "@/hooks/rhf"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AuthorityScopeBase } from "./component"
import type { ScopeGroupView } from "./component"

/** The automation scope: modes and VND limits are edited in a react-hook-form form and saved rule by rule through the back end. */
export const AuthorityScope = () => {
    const t = useTranslations("authority")
    const g = useTranslations("governance")
    const slotLabels = useSlotLabels()
    const { slot, reload, rules, isLocked } = useAuthoritySection()
    const instances = useInstanceNames()
    const { form, stored } = useAuthorityScopeForm(rules)
    const { save, isSaving } = useSaveAuthorityRules()
    const drafts = form.watch("drafts")

    const groupsOf = (): ReadonlyArray<ScopeGroupView> =>
        visibleGroups(rules).map((group) => {
            const names = instances[group.department] ?? []
            return {
                department: group.department,
                title: g(`dept_${group.department}`),
                shared: names.length > 1 ? t("instancesShared", { names: names.join(", ") }) : "",
                rows: group.actions.map((action) => {
                    const key = ruleKey(group.department, action)
                    const draft = drafts[key]
                    const mode = draft?.mode ?? "ask"
                    return {
                        key,
                        name: g(`action_${action}`),
                        modeLabel: t("modeLabel", { action: g(`action_${action}`) }),
                        modes: modesFor(action).map((one) => ({ value: one, label: g(`mode_${one}`) })),
                        mode,
                        hasLimit: hasAmountLimit(action),
                        limit: toField(draft?.limit ?? null),
                        isLimitOff: mode === "never",
                    }
                }),
            }
        })

    const setMode = (key: string, value: string) => {
        const draft = drafts[key]
        const mode = authorityModeOf(value)
        if (draft === undefined || mode === null) return
        form.setValue("drafts", { ...drafts, [key]: { ...draft, mode } })
    }
    const setLimit = (key: string, value: number) => {
        const draft = drafts[key]
        if (draft === undefined) return
        form.setValue("drafts", { ...drafts, [key]: { ...draft, limit: fromField(value) } })
    }
    const submit = form.handleSubmit(async (next) => {
        const changes = ruleChanges(stored, next.drafts, "scope")
        if (changes.length > 0) await save(changes)
    })

    return (
        <AuthorityScopeBase
            props={{
                section: {
                    title: t("scopeTitle"),
                    description: t("scopeDesc"),
                    saveLabel: t("saveLabel"),
                    isPending: isSaving,
                    isLocked,
                },
                limitLabel: t("limitLabel"),
                limitHint: t("limitHint"),
                slot: mapSlot(slot, groupsOf),
                placeholder: groupsOf(),
                slotLabels: slotLabels(t("loadFailTitle")),
            }}
            on={{ mode: setMode, limit: setLimit, save: () => void submit(), retry: reload }}
        />
    )
}
