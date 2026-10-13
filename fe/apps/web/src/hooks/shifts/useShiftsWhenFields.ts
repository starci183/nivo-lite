"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useShiftsFormat } from "./useShiftsFormat"

const DATE_CHOICES = 90

/** What is typed about when someone can or cannot work. */
interface WhenForm {
    /** "weekday" = every week, "date" = one day. */
    readonly mode: string
    readonly weekday: string
    readonly date: string
    readonly start: string
    readonly end: string
}

/** One field of a form card: a select when it has options. */
interface WhenField {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
}

/** The select fields that say when: how often, the weekday or the date, and the two times. */
export const useShiftsWhenFields = (form: WhenForm, today: string): ReadonlyArray<WhenField> => {
    const t = useTranslations("shifts")
    const format = useShiftsFormat()
    return useMemo(
        () => [
            {
                id: "mode",
                label: t("availMode"),
                value: form.mode,
                options: [
                    { id: "weekday", label: t("everyWeek") },
                    { id: "date", label: t("oneDay") },
                ],
            },
            form.mode === "weekday"
                ? { id: "weekday", label: t("weekday"), value: form.weekday, options: format.weekdays }
                : { id: "date", label: t("date"), value: form.date, options: format.dates(today, DATE_CHOICES) },
            { id: "start", label: t("fromTime"), value: form.start, options: format.times },
            { id: "end", label: t("toTime"), value: form.end, options: format.times },
        ],
        [t, format, form.mode, form.weekday, form.date, form.start, form.end, today],
    )
}
