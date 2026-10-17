"use client"

import { useTranslations } from "next-intl"
import { usePublicBookingForm, usePublicBookingPage } from "@/hooks/publicBooking"
import { PublicBookingContentBase } from "./component"

/** The shop slug passed by the server page. */
interface PublicBookingContentProps {
    readonly slug: string
}

/** Reads the anonymous booking page in the browser and renders its current state. */
export const PublicBookingContent = (props: PublicBookingContentProps) => {
    const { slug } = props
    const t = useTranslations("workbenchBooking")
    const app = useTranslations("app")
    const shell = useTranslations("shell")
    const page = usePublicBookingPage(slug)
    const form = usePublicBookingForm(page.data)
    return (
        <PublicBookingContentBase
            props={{
                title: t("publicTitle"),
                page: page.data,
                form: form.props,
                failed: page.failed,
                loadingLabel: shell("loading"),
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
                notFoundTitle: app("notFoundTitle"),
                notFoundText: app("notFoundText"),
                homeLabel: app("notFoundHome"),
            }}
            on={form.on}
        />
    )
}
