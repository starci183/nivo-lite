"use client"

import { useTranslations } from "next-intl"
import { AppErrorPageBase } from "./component"

type AppErrorPageProps = { readonly onRetry: () => void }

/** A render failure with the segment retry. */
export const AppErrorPage = (props: AppErrorPageProps) => {
    const t = useTranslations("app")
    return (
        <AppErrorPageBase
            props={{ title: t("errorTitle"), text: t("errorText"), retryLabel: t("retry") }}
            on={{ retry: props.onRetry }}
        />
    )
}
