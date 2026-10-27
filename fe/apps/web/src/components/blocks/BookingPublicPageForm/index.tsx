"use client"

import { useBookingBoard } from "@/hooks/bookingBoard"
import { useSlotLabels } from "@/hooks/slot"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useMutateSaveBookingPublicPageSwr } from "@/hooks/swr"
import { useBookingSetupSave } from "@/hooks/bookingSetup"
import { BookingPublicPageFormBase } from "./component"

/** What the owner has typed so far; a field not touched keeps showing the saved value. */
interface Edits {
    readonly enabled?: boolean
    readonly slug?: string
    readonly note?: string
}

/** The connected public page form: the switch, the address and the note of the booking page of the shop. */
export const BookingPublicPageForm = () => {
    const t = useTranslations("workbenchBooking")
    const persist = useBookingSetupSave()
    const savePage = useMutateSaveBookingPublicPageSwr()
    const slotLabels = useSlotLabels()
    const { board, slot, reload } = useBookingBoard()
    const settings = board.settings
    const [edits, setEdits] = useState<Edits>({})
    const enabled = edits.enabled ?? settings.publicEnabled
    const slug = edits.slug ?? settings.publicSlug ?? ""
    const note = edits.note ?? settings.publicNote
    const [isPending, startTransition] = useTransition()
    const save = () =>
        startTransition(async () => {
            const answer = await persist(() => savePage.trigger({ enabled, slug, note }))
            if (answer === undefined) return
        })
    return (
        <BookingPublicPageFormBase
            props={{
                slot,
                slotLabels: slotLabels(t("loadFailedTitle")),
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
                isPending: isPending || slot.isLoading === true,
            }}
            on={{
                retry: reload,
                toggleEnabled: (value) => setEdits({ ...edits, enabled: value }),
                changeSlug: (value) => setEdits({ ...edits, slug: value }),
                changeNote: (value) => setEdits({ ...edits, note: value }),
                save,
            }}
        />
    )
}
