"use client"

import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { useWatch } from "react-hook-form"
import { useCreateLead } from "@/hooks/leads"
import { useLeadCreateForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { LEADS_ROUTES, leadPath } from "@/modules/routes"
import { LeadCreateFormBase } from "./component"

const CHANNEL_KEYS = [
    "channelZalo",
    "channelWebsiteChat",
    "channelWebsiteForm",
    "channelPhone",
    "channelEmail",
    "channelReferral",
] as const

/** Captures a lead and polls its queued preparation before opening the journey. */
export const LeadCreateForm = () => {
    const t = useTranslations("leads")
    const router = navigation.useRouter()
    const form = useLeadCreateForm()
    const values = useWatch({ control: form.control })
    const action = useCreateLead()
    const isPending = action.isPending
    const failure = action.error
    const errors = Object.fromEntries(Object.entries(form.formState.errors).map(([key, error]) => [key, error.message]))
    useEffect(() => {
        if (action.result?.leadId) router.push(leadPath(action.result.leadId))
    }, [action.result?.leadId, router])
    const submit = form.handleSubmit(async (input) => {
        await action.create(input)
    })

    return (
        <LeadCreateFormBase
            props={{
                title: t("formTitle"),
                intro: t("formIntro"),
                contactLabel: t("formContact"),
                contactHint: t("formContactHint"),
                companyLabel: t("formCompany"),
                companyHint: t("formCompanyHint"),
                channelLabel: t("formChannel"),
                channelHint: t("formChannelHint"),
                channelPlaceholder: t("formChannelPlaceholder"),
                channelOptions: CHANNEL_KEYS.map((key) => ({ id: t(key), label: t(key) })),
                afterNote: t("formAfter"),
                needLabel: t("formNeed"),
                needHint: t("formNeedHint"),
                cancelLabel: t("formCancel"),
                submitLabel: t("formSubmit"),
                pendingText: isPending ? t("formPending") : "",
                failTitle: t("formFailTitle"),
                values: {
                    contact_name: values.contact_name ?? "",
                    company: values.company ?? "",
                    channel: values.channel ?? "",
                    need: values.need ?? "",
                },
                errors,
                failure,
                isPending,
            }}
            on={{
                change: (field, value) =>
                    form.setValue(field, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
                submit: () => {
                    void submit()
                },
                cancel: () => router.replace(LEADS_ROUTES.leads),
            }}
        />
    )
}
