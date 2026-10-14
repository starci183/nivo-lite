"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { PRODUCT_TIME_ZONE } from "@/modules/i18n"

/** The formatters of the Hiring screens: money, pay ranges, dates on the Vietnam clock, relative times and catalog labels of a value. */
export interface HiringFormat {
    readonly money: (value: number) => string
    readonly pay: (min: number | null, max: number | null, unit: string) => string
    /** Weekday, time and date of an instant on the Vietnam clock. */
    readonly dateTime: (iso: string) => string
    readonly date: (iso: string) => string
    readonly time: (iso: string) => string
    /** Weekday name and day-month of an instant on the Vietnam clock. */
    readonly dayLabel: (iso: string) => string
    readonly ago: (iso: string, nowIso: string) => string
    /** The catalog label `<prefix>_<value>`, or the value itself when the catalog has none. */
    readonly label: (prefix: string, value: string) => string
}

/** The Hiring formatters bound to the active locale. */
export const useHiringFormat = (): HiringFormat => {
    const t = useTranslations("hiring")
    const format = useFormatter()
    return useMemo<HiringFormat>(() => {
        const money = (value: number): string =>
            format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
        const label = (prefix: string, value: string): string =>
            t.has(`${prefix}_${value}`) ? t(`${prefix}_${value}`) : value
        return {
            money,
            pay: (min, max, unit) => {
                const per = label("payUnit", unit)
                if (min !== null && max !== null && min > 0 && max > 0) {
                    return min === max
                        ? t("payExact", { value: money(min), unit: per })
                        : t("payBetween", { min: money(min), max: money(max), unit: per })
                }
                if (min !== null && min > 0) return t("payFrom", { value: money(min), unit: per })
                if (max !== null && max > 0) return t("payUpTo", { value: money(max), unit: per })
                return t("payNegotiable")
            },
            dateTime: (iso) =>
                format.dateTime(new Date(iso), {
                    weekday: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: PRODUCT_TIME_ZONE,
                }),
            date: (iso) =>
                format.dateTime(new Date(iso), {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: PRODUCT_TIME_ZONE,
                }),
            time: (iso) =>
                format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit", timeZone: PRODUCT_TIME_ZONE }),
            dayLabel: (iso) =>
                format.dateTime(new Date(iso), {
                    weekday: "long",
                    day: "2-digit",
                    month: "2-digit",
                    timeZone: PRODUCT_TIME_ZONE,
                }),
            ago: (iso, nowIso) => format.relativeTime(new Date(iso), new Date(nowIso)),
            label,
        }
    }, [format, t])
}
