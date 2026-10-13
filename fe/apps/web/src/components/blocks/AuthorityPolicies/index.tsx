"use client"

import { useTranslations } from "next-intl"
import { useAuthoritySection } from "@/hooks/authority"
import { useAuthorityPoliciesForm } from "@/hooks/rhf"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AuthorityPoliciesBase } from "./component"

/** The policies section: the three texts are edited in a react-hook-form form and saved through the back end. */
export const AuthorityPolicies = () => {
    const t = useTranslations("authority")
    const slotLabels = useSlotLabels()
    const { slot, reload, profile, isLocked, save, isSaving } = useAuthoritySection()
    const form = useAuthorityPoliciesForm(profile)
    const values = form.watch()
    const submit = form.handleSubmit(async (next) => {
        await save({ policies: next.policies, reply_style: next.replyStyle, brand_voice: next.brandVoice })
    })
    return (
        <AuthorityPoliciesBase
            props={{
                section: {
                    title: t("policiesTitle"),
                    description: t("policiesDesc"),
                    saveLabel: t("saveLabel"),
                    isPending: isSaving,
                    isLocked,
                },
                policiesLabel: t("policies"),
                policiesHint: t("policiesHint"),
                replyStyleLabel: t("replyStyle"),
                replyStyleHint: t("replyStyleHint"),
                brandVoiceLabel: t("brandVoice"),
                brandVoiceHint: t("brandVoiceHint"),
                slot: mapSlot(slot, () => true),
                slotLabels: slotLabels(t("loadFailTitle")),
                policies: values.policies,
                replyStyle: values.replyStyle,
                brandVoice: values.brandVoice,
            }}
            on={{
                policies: (value) => form.setValue("policies", value),
                replyStyle: (value) => form.setValue("replyStyle", value),
                brandVoice: (value) => form.setValue("brandVoice", value),
                save: () => void submit(),
                retry: reload,
            }}
        />
    )
}
