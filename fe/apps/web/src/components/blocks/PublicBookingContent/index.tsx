"use client"

import { useTranslations } from "next-intl"
import { usePublicBookingForm, usePublicBookingPage } from "@/hooks/publicBooking"
import { useSlotLabels } from "@/hooks/slot"
import { useLocaleSwitch } from "@/hooks/locale"
import { PublicBookingContentBase } from "./component"

/** The shop slug passed by the server page. */
interface PublicBookingContentProps {
    readonly slug: string
}

/** Reads the anonymous booking page in the browser and renders its current state. */
export const PublicBookingContent = (props: PublicBookingContentProps) => {
    const { slug } = props
    const t = useTranslations("workbenchBooking")
    const pub = useTranslations("publicPages")
    const labelsOf = useSlotLabels()
    const language = useLocaleSwitch()
    const page = usePublicBookingPage(slug)
    const form = usePublicBookingForm(page.data)
    return (
        <PublicBookingContentBase
            props={{
                form: form.props,
                slot: page.slot,
                language: {
                    label: language.label,
                    locale: language.locale,
                    isPending: language.isPending,
                    options: language.options,
                },
                labels: labelsOf(pub("bookingNotFoundTitle")),
                copy: {
                    title: t("publicTitle"),
                    brandFallback: pub("brandFallback"),
                    foot: pub("foot"),
                    intro: pub("bookingIntro"),
                    notFoundBody: pub("bookingNotFoundBody"),
                    failedBody: pub("bookingFailedBody"),
                },
            }}
            on={{ ...form.on, retry: page.retry, chooseLanguage: language.choose }}
        />
    )
}
