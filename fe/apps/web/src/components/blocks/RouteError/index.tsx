"use client"

import { useTranslations } from "next-intl"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { RouteErrorBase } from "./component"

/** What a failed route tells the block. */
type RouteErrorProps = {
    /** The page's own trail (the current page last). */
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    /** The page's own heading: it stays real when the data fails. */
    readonly title: string
    /** What could not load, in the page's words; defaults to the generic line. */
    readonly message?: string
    /** Retry the route (Next's error boundary `reset`, or a router refresh). */
    readonly onRetry?: () => void
}

/** A route whose data failed keeps its chrome and anatomy: trail, heading and one negative Alert with the retry. */
export const RouteError = (props: RouteErrorProps) => {
    const t = useTranslations("shell")
    return (
        <RouteErrorBase
            props={{
                crumbs: props.crumbs,
                crumbLabel: t("crumbLabel"),
                title: props.title,
                alertTitle: t("errorTitle"),
                message: props.message ?? t("errorText"),
                retryLabel: t("retry"),
            }}
            on={{ retry: props.onRetry }}
        />
    )
}
