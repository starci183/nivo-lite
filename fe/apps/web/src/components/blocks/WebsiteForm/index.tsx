"use client"

import { useTranslations } from "next-intl"
import { useLocaleSwitch } from "@/hooks/locale"
import { useWebsiteForm } from "@/hooks/websiteForm"
import { WebsiteTheme } from "@/components/providers/WorkspaceTheme"
import { WebsiteFormBase } from "./component"

/** The key of the hosted form, passed by the server page. */
interface WebsiteFormProps {
    readonly siteKey: string
}

/** The hosted form of a shop website: a visitor leaves a name, a phone and a message, and the shop receives them as a new customer. */
export const WebsiteForm = (props: WebsiteFormProps) => {
    const t = useTranslations("websiteForm")
    const tp = useTranslations("publicPages")
    const language = useLocaleSwitch()
    const form = useWebsiteForm(props.siteKey)
    return (
        <WebsiteFormBase
            props={{
                theme: <WebsiteTheme siteKey={props.siteKey} />,
                copy: {
                    title: t("title"),
                    intro: t("intro"),
                    nameLabel: t("nameLabel"),
                    phoneLabel: t("phoneLabel"),
                    messageLabel: t("messageLabel"),
                    submit: t("submit"),
                    sentTitle: t("sentTitle"),
                    sentBody: t("sentBody"),
                    again: t("again"),
                    offBody: t("offBody"),
                    emptyBody: t("emptyBody"),
                    failedBody: t("failedBody"),
                },
                values: form.values,
                status: form.status,
                foot: tp("foot"),
                brandFallback: tp("brandFallback"),
                language: {
                    label: language.label,
                    locale: language.locale,
                    isPending: language.isPending,
                    options: language.options,
                },
            }}
            on={{
                setName: form.setName,
                setPhone: form.setPhone,
                setMessage: form.setMessage,
                submit: form.submit,
                again: form.again,
                chooseLanguage: language.choose,
            }}
        />
    )
}
