"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import {
    calendarLocaleOf,
    lackOf,
    pageDays,
    publicBookingLabels,
    resultKey,
    serviceOptionsOf,
    summaryOf,
} from "./publicBooking.shared"
import { usePublicBooking } from "./usePublicBooking"
import { shortDayText, wallClockText, wallDate, wallMinutes } from "@/modules/i18n"
import type { PublicBookingPageData } from "@/modules/types"
import type { PublicBookingFields } from "./usePublicBooking"

type UsePublicBookingFormResult = {
    props: {
        refusal?: {
            message: string
            alternatives: {
                value: string
                label: string
                date: string
            }[]
        }
        done?: {
            title: string
            message: string
            alternatives: {
                value: string
                label: string
                date: string
            }[]
        }
        formLabel: string
        calendarLocale: string
        fields: PublicBookingFields
        services: {
            value: string
            label: string
            description: string
        }[]
        noServicesText: string
        days: {
            value: string
            label: string
        }[]
        times:
            | {
                  value: string
                  label: string
              }[]
            | null
        labels: {
            step1: string
            step2: string
            step3: string
            finding: string
            noTimes: string
            pickTime: string
            name: string
            phone: string
            email: string
            party: string
            note: string
            website: string
            submit: string
            footnote: string
            again: string
            alternatives: string
            notePlaceholder: string
            previousMonth: string
            nextMonth: string
        }
        isBusy: boolean
        /** What the visitor chose, in one line: the service, the day and time, the price. Empty until a time is chosen. */
        summary: string
        /** What a send without a choice asks for; empty when nothing is missing. */
        need: string
    }
    on: {
        change: (patch: Partial<PublicBookingFields>) => void
        submit: () => void
        again: () => void
        pickAlternative: (start: string, date: string) => void
    }
}

/** The connected public booking form: free times follow the service and the day through the `publicBookingTimes` query, and a send goes through `requestPublicBooking`. */
export const usePublicBookingForm = (page: PublicBookingPageData | null | undefined): UsePublicBookingFormResult => {
    const t = useTranslations("workbenchBooking")
    const pub = useTranslations("publicPages")
    const format = useFormatter()
    const locale = useLocale()
    const booking = usePublicBooking(page)
    const [missing, setMissing] = useState<"" | "service" | "time">("")
    const { today } = booking
    const zone = page?.timezone ?? "UTC"
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const clock = (iso: string) => wallClockText(wallMinutes(Date.parse(iso), zone))
    const dayText = (date: string) => shortDayText(new Date(`${date}T12:00:00Z`), "UTC", locale)
    const whenText = (iso: string) => `${clock(iso)} ${dayText(wallDate(Date.parse(iso), zone))}`
    const { result } = booking
    const answer = result?.kind === "answered" ? result.answer : null
    const message =
        result === null
            ? ""
            : t(resultKey(result), {
                  service: answer?.service ?? "",
                  when: answer === null || answer.start === "" ? "" : whenText(answer.start),
              })
    const alternatives = (answer?.alternatives ?? []).map((iso) => ({
        value: iso,
        label: whenText(iso),
        date: wallDate(Date.parse(iso), zone),
    }))
    const succeeded = answer?.ok === true
    const summary = summaryOf(page, booking.fields, {
        at: t("publicAt"),
        day: dayText,
        clock,
        money,
    })
    const submit = (): void => {
        const lacking = lackOf(booking.fields)
        setMissing(lacking)
        if (lacking === "") booking.submit()
    }
    const needKey = missing === "service" ? "bookingNeedService" : "bookingNeedTime"
    const needText = missing === "" ? "" : pub(needKey)
    return {
        props: {
            formLabel: t("publicFormLabel"),
            calendarLocale: calendarLocaleOf(locale),
            fields: booking.fields,
            services: serviceOptionsOf(page, t, money),
            noServicesText: t("publicNoServices"),
            days: (today === "" ? [] : pageDays(today)).map((day) => ({ value: day, label: dayText(day) })),
            times: booking.times === null ? null : booking.times.map((iso) => ({ value: iso, label: clock(iso) })),
            labels: publicBookingLabels(t),
            isBusy: booking.isBusy,
            summary,
            need: lackOf(booking.fields) === "" ? "" : needText,
            ...(succeeded
                ? {
                      done: {
                          title: t(answer.state === "confirmed" ? "publicDoneConfirmed" : "publicDoneSent"),
                          message,
                          alternatives,
                      },
                  }
                : {}),
            ...(result !== null && !succeeded ? { refusal: { message, alternatives } } : {}),
        },
        on: {
            change: booking.change,
            submit,
            again: booking.again,
            pickAlternative: booking.pick,
        },
    }
}
