"use client"

import { useTranslations } from "next-intl"
import { fromField, toField, useAuthoritySection } from "@/hooks/authority"
import { useAuthorityGoalsForm } from "@/hooks/rhf"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AuthorityGoalsBase } from "./component"

/** The goals section: the targets are edited in a react-hook-form form and saved through the back end. */
export const AuthorityGoals = () => {
    const t = useTranslations("authority")
    const slotLabels = useSlotLabels()
    const { slot, reload, profile, isLocked, save, isSaving } = useAuthoritySection()
    const form = useAuthorityGoalsForm(profile)
    const values = form.watch()
    const submit = form.handleSubmit(async (next) => {
        await save({
            goal_revenue_vnd: next.goalRevenue,
            goal_new_customers: next.goalCustomers,
            goal_first_reply_minutes: next.goalReply,
            goal_note: next.goalNote,
        })
    })
    return (
        <AuthorityGoalsBase
            props={{
                section: {
                    title: t("goalsTitle"),
                    description: t("goalsDesc"),
                    saveLabel: t("saveLabel"),
                    isPending: isSaving,
                    isLocked,
                },
                revenueLabel: t("goalRevenue"),
                revenueHint: t("goalRevenueHint"),
                customersLabel: t("goalCustomers"),
                replyLabel: t("goalReply"),
                noteLabel: t("goalNote"),
                noteHint: t("goalNoteHint"),
                slot: mapSlot(slot, () => true),
                slotLabels: slotLabels(t("loadFailTitle")),
                revenue: toField(values.goalRevenue),
                customers: toField(values.goalCustomers),
                reply: toField(values.goalReply),
                note: values.goalNote,
            }}
            on={{
                revenue: (value) => form.setValue("goalRevenue", fromField(value)),
                customers: (value) => form.setValue("goalCustomers", fromField(value)),
                reply: (value) => form.setValue("goalReply", fromField(value)),
                note: (value) => form.setValue("goalNote", value),
                save: () => void submit(),
                retry: reload,
            }}
        />
    )
}
