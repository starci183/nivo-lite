"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { navigation } from "@/modules/i18n"
import { writeCreateLead } from "@/modules/db/leads/write-lead-actions"
import { LEADS_ROUTES, leadPath } from "@/modules/routes"
import { LeadCreateFormBase } from "./component"
import type { LeadFormValues } from "./component"

type Errors = Partial<Record<keyof LeadFormValues, string>>

const EMPTY: LeadFormValues = { contact_name: "", company: "", channel: "", need: "" }

/** The channel names the form offers, by catalog key. */
interface LeadCreateFormProps {
    readonly channelKeys: ReadonlyArray<string>
}

/** Captures a lead by hand; the engine adds context and an owner before the lead page opens. */
export const LeadCreateForm = (props: LeadCreateFormProps) => {
    const t = useTranslations("leads")
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [values, setValues] = useState<LeadFormValues>(EMPTY)
    const [errors, setErrors] = useState<Errors>({})
    const [failure, setFailure] = useState<string | null>(null)

    const validate = (): Errors => ({
        ...(values.contact_name.trim().length < 2 ? { contact_name: t("errContact") } : {}),
        ...(values.company.trim().length < 2 ? { company: t("errCompany") } : {}),
        ...(values.channel === "" ? { channel: t("errChannel") } : {}),
        ...(values.need.trim().length < 5 ? { need: t("errNeed") } : {}),
    })

    const submit = () => {
        const found = validate()
        setErrors(found)
        setFailure(null)
        if (Object.keys(found).length > 0) return
        startTransition(async () => {
            const result = await writeCreateLead(values)
            if (result.kind === "ok") router.push(leadPath(result.value.leadId))
            else setFailure(result.kind === "unavailable" ? result.code : t("formFailTitle"))
        })
    }

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
                channelOptions: props.channelKeys.map((key) => ({ id: t(key), label: t(key) })),
                afterNote: t("formAfter"),
                needLabel: t("formNeed"),
                needHint: t("formNeedHint"),
                cancelLabel: t("formCancel"),
                submitLabel: t("formSubmit"),
                pendingText: isPending ? t("formPending") : "",
                failTitle: t("formFailTitle"),
                values,
                errors,
                failure,
                isPending,
            }}
            on={{
                change: (field, value) => setValues((previous) => ({ ...previous, [field]: value })),
                submit,
                cancel: () => router.replace(LEADS_ROUTES.leads),
            }}
        />
    )
}
