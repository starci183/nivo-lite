"use client"

import { useFeatureReset } from "@/hooks/reuseables"

import { useBookingTransition } from "@/hooks/bookingDesk"

import type { useBookingBoard } from "@/hooks/bookingBoard"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useBookingSettingsCommands } from "@/hooks/bookingSetup"

/** What the owner has typed so far; a field not touched keeps showing the saved value. */
interface Edits {
    readonly enabled?: boolean
    readonly slug?: string
    readonly note?: string
}

/** The connected public page form: the switch, the address and the note of the booking page of the shop. */
export const useBookingPublicPageFormView = (
    isActive: boolean,
    scope: string,
    boardRead: ReturnType<typeof useBookingBoard>,
) => {
    const t = useTranslations("workbenchBooking")
    const commands = useBookingSettingsCommands()
    const { board } = boardRead
    const settings = board.settings
    const [edits, setEdits] = useState<Edits>({})
    useFeatureReset({
        isActive: isActive,
        isReady: true,
        scope: scope,
        onReset: () => {
            setEdits({})
        },
    })
    const enabled = edits.enabled ?? settings.publicEnabled
    const slug = edits.slug ?? settings.publicSlug ?? ""
    const note = edits.note ?? settings.publicNote
    const { isPending, run: startTransition } = useBookingTransition(isActive, scope)
    const save = () =>
        startTransition(async () => {
            const answer = await commands.savePublicPage({ enabled, slug, note })
            if (answer === undefined) return
        })
    return {
        props: {
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
            isPending: isPending,
        },
        on: {
            toggleEnabled: (value: boolean) => setEdits({ ...edits, enabled: value }),
            changeSlug: (value: string) => setEdits({ ...edits, slug: value }),
            changeNote: (value: string) => setEdits({ ...edits, note: value }),
            save,
        },
    } as const
}
