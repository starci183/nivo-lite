"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useSWRConfig } from "swr"
import { isQueryBookingBoardSwrKey, useMutateSaveBookingPublicPageSwr } from "@/hooks/swr/api/graphql"
import { useGraphQLWithToast } from "@/modules/toast"
import type { BookingSettingsView } from "@/modules/types"
import { BookingPublicPageFormBase } from "./component"

/** What the setup tab hands the connected public page form. */
interface BookingPublicPageFormProps {
    readonly settings: BookingSettingsView
}

/** The connected public page form: the switch, the address and the note of the booking page of the shop. */
export const BookingPublicPageForm = (props: BookingPublicPageFormProps) => {
    const t = useTranslations("workbenchBooking")
    const withToast = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const savePage = useMutateSaveBookingPublicPageSwr()
    const { settings } = props
    const [enabled, setEnabled] = useState(settings.publicEnabled)
    const [slug, setSlug] = useState(settings.publicSlug ?? "")
    const [note, setNote] = useState(settings.publicNote)
    const [isPending, startTransition] = useTransition()
    const save = () =>
        startTransition(async () => {
            const answer = await withToast(() => savePage.trigger({ enabled, slug, note }), {
                successMessage: t("saved"),
            })
            if (answer === undefined) return
            void mutate(isQueryBookingBoardSwrKey)
        })
    return (
        <BookingPublicPageFormBase
            props={{
                title: t("pageTitle"),
                hint: t("pageHint"),
                enabledLabel: t("pageEnabled"),
                enabled,
                slugLabel: t("pageSlug"),
                slug,
                slugPlaceholder: t("pageSlugPlaceholder"),
                noteLabel: t("pageNote"),
                note,
                notePlaceholder: t("pageNotePlaceholder"),
                ...(settings.publicEnabled && settings.publicSlug !== null
                    ? { link: { label: t("pageLink"), href: `/b/${settings.publicSlug}`, hint: t("pageLinkHint") } }
                    : {}),
                saveLabel: t("pageSave"),
                isPending,
            }}
            on={{ toggleEnabled: setEnabled, changeSlug: setSlug, changeNote: setNote, save }}
        />
    )
}
