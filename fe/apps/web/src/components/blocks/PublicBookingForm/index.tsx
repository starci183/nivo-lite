"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { pageDays, resultKey, usePublicBooking } from "@/hooks/publicBooking"
import { wallClockText, wallDate, wallMinutes } from "@/modules/i18n"
import type { PublicBookingPageData } from "@/modules/types"
import { PublicBookingFormBase } from "./component"

/** What the page hands the connected form. */
interface PublicBookingFormProps {
    readonly page: PublicBookingPageData
}

/** The connected public booking form: free times follow the service and the day through the `publicBookingTimes` query, and a send goes through `requestPublicBooking`. */
export const PublicBookingForm = (props: PublicBookingFormProps) => {
    const { page } = props
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const zone = page.timezone
    const [today] = useState(() => wallDate(Date.now(), zone))
    const booking = usePublicBooking(page, today)
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const clock = (iso: string) => wallClockText(wallMinutes(Date.parse(iso), zone))
    const dayText = (date: string) =>
        format.dateTime(new Date(`${date}T12:00:00Z`), {
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            timeZone: "UTC",
        })
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
    const succeeded = answer !== null && answer.ok
    return (
        <PublicBookingFormBase
            props={{
                formLabel: t("publicFormLabel"),
                fields: booking.fields,
                services: page.services.map((service) => ({
                    value: service.id,
                    label: service.name,
                    description: [
                        t("publicServiceLine", { minutes: service.durationMin }),
                        service.priceVnd === null || service.priceVnd === 0 ? "" : money(service.priceVnd),
                        service.description,
                    ]
                        .filter((part) => part !== "")
                        .join(" · "),
                })),
                noServicesText: t("publicNoServices"),
                days: pageDays(today).map((day) => ({ value: day, label: dayText(day) })),
                times: booking.times === null ? null : booking.times.map((iso) => ({ value: iso, label: clock(iso) })),
                labels: {
                    step1: t("publicStep1"),
                    step2: t("publicStep2"),
                    step3: t("publicStep3"),
                    finding: t("publicFinding"),
                    noTimes: t("publicNoTimes"),
                    pickTime: t("publicPickTime"),
                    name: t("publicName"),
                    phone: t("publicPhone"),
                    email: t("publicEmail"),
                    party: t("publicParty"),
                    note: t("publicNote"),
                    website: t("publicWebsite"),
                    submit: t("publicSubmit"),
                    footnote: t("publicFootnote"),
                    again: t("publicAgain"),
                    alternatives: t("publicAlternatives"),
                },
                isBusy: booking.isBusy,
                ...(succeeded
                    ? {
                          done: {
                              title: t(answer.state === "confirmed" ? "publicDoneConfirmed" : "publicDoneSent"),
                              message,
                              alternatives,
                          },
                      }
                    : {}),
                ...(result !== null && !succeeded ? { failure: { message, alternatives } } : {}),
            }}
            on={{
                change: booking.change,
                submit: booking.submit,
                again: booking.again,
                pickAlternative: booking.pick,
            }}
        />
    )
}
