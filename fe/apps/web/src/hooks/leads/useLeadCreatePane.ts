"use client"

import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { useWatch } from "react-hook-form"
import { useLeadCreateForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { leadPath, LEADS_ROUTES, workspaceHref } from "@/modules/routes"
import type { LeadCreateDialogProps } from "@/modules/types"
import { useCreateLead } from "./useCreateLead"
import { useWorkspaceId } from "@/hooks/workspaces"

const CHANNEL_KEYS = [
    "channelZalo",
    "channelWebsiteChat",
    "channelWebsiteForm",
    "channelPhone",
    "channelEmail",
    "channelReferral",
] as const

/** The new-lead dialog's words, values and commands; the address (`?new=1`) says whether it is open, and a created lead opens its page. */
export const useLeadCreatePane = (isOpen: boolean): LeadCreateDialogProps => {
    const t = useTranslations("leads")
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const form = useLeadCreateForm()
    const values = useWatch({ control: form.control })
    const action = useCreateLead()
    const errors = Object.fromEntries(Object.entries(form.formState.errors).map(([key, error]) => [key, error.message]))
    useEffect(() => {
        if (action.result?.leadId) router.push(workspaceHref(workspaceId, leadPath(action.result.leadId)))
    }, [action.result?.leadId, router, workspaceId])
    const submit = form.handleSubmit(async (input) => {
        await action.create(input)
    })
    return {
        props: {
            isOpen,
            title: t("formTitle"),
            intro: t("formIntro"),
            closeLabel: t("formCancel"),
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
            pendingText: action.isPending ? t("formPending") : "",
            failTitle: t("formFailTitle"),
            values: {
                contact_name: values.contact_name ?? "",
                company: values.company ?? "",
                channel: values.channel ?? "",
                need: values.need ?? "",
            },
            errors,
            submitError: action.error,
            isPending: action.isPending,
        },
        on: {
            change: (field, value) =>
                form.setValue(field, value, { shouldDirty: true, shouldValidate: form.formState.isSubmitted }),
            submit: () => {
                void submit()
            },
            close: () => router.replace(workspaceHref(workspaceId, LEADS_ROUTES.leads)),
        },
    }
}
