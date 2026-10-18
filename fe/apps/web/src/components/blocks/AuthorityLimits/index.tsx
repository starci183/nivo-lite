"use client"

import { useTranslations } from "next-intl"
import {
    FIELD_KEYS,
    ruleChanges,
    ruleKey,
    useAuthoritySection,
    useSaveAuthorityRules,
    visibleGroups,
} from "@/hooks/authority"
import { useAuthorityLimitsForm } from "@/hooks/rhf"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AuthorityLimitsBase, type LimitsView } from "./component"

/** The limits section: the note and the required details are edited in a react-hook-form form and saved through the back end. */
export const AuthorityLimits = () => {
    const t = useTranslations("authority")
    const g = useTranslations("governance")
    const slotLabels = useSlotLabels()
    const { slot, reload, profile, rules, isLocked, save: saveProfile, isSaving: isSavingNote } = useAuthoritySection()
    const { form, stored } = useAuthorityLimitsForm(profile.limitsNote, rules)
    const { save: saveRules, isSaving: isSavingRules } = useSaveAuthorityRules()
    const drafts = form.watch("drafts")

    const viewOf = (): LimitsView => ({
        rows: visibleGroups(rules).flatMap((group) =>
            group.actions.map((action) => {
                const key = ruleKey(group.department, action)
                return {
                    key,
                    label: t("requiredFor", { action: `${g("action_" + action)} · ${g("dept_" + group.department)}` }),
                    value: drafts[key]?.required ?? [],
                }
            }),
        ),
    })
    const setRequired = (key: string, value: ReadonlyArray<string>) => {
        const draft = drafts[key]
        if (draft === undefined) return
        form.setValue("drafts", {
            ...drafts,
            [key]: { ...draft, required: FIELD_KEYS.filter((one) => value.includes(one)) },
        })
    }
    const submit = form.handleSubmit(async (next) => {
        if (next.limitsNote.trim() !== profile.limitsNote) await saveProfile({ limits_note: next.limitsNote.trim() })
        const changes = ruleChanges(stored, next.drafts, "required")
        if (changes.length > 0) await saveRules(changes)
    })

    return (
        <AuthorityLimitsBase
            props={{
                section: {
                    title: t("limitsTitle"),
                    description: t("limitsDesc"),
                    saveLabel: t("saveLabel"),
                    isPending: isSavingNote || isSavingRules,
                    isLocked,
                },
                noteLabel: t("limitsNote"),
                noteHint: t("limitsNoteHint"),
                requiredTitle: t("requiredTitle"),
                requiredHint: t("requiredHint"),
                fields: FIELD_KEYS.map((field) => ({ value: field, label: g(`field_${field}`) })),
                slot: mapSlot(slot, viewOf),
                placeholder: viewOf(),
                slotLabels: slotLabels(t("loadFailTitle")),
                note: form.watch("limitsNote"),
            }}
            on={{
                note: (value) => form.setValue("limitsNote", value),
                required: setRequired,
                save: () => void submit(),
                retry: reload,
            }}
        />
    )
}
