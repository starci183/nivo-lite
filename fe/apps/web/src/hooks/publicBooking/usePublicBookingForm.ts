"use client"

import { useFormatter, useTranslations } from "next-intl"
import { pageDays, resultKey } from "./publicBooking.shared"
import { usePublicBooking } from "./usePublicBooking"
import { wallClockText, wallDate, wallMinutes } from "@/modules/i18n"
import type { PublicBookingPageData } from "@/modules/types"

/** The connected public booking form: free times follow the service and the day through the `publicBookingTimes` query, and a send goes through `requestPublicBooking`. */
export const usePublicBookingForm = (page: PublicBookingPageData | null | undefined) => {
    const t = useTranslations("workbenchBooking")
    const format = useFormatter()
    const booking = usePublicBooking(page)
    const { today } = booking
    const zone = page?.timezone ?? "UTC"
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
    const succeeded = answer?.ok === true
    return {
        props: {
            formLabel: t("publicFormLabel"),
            fields: booking.fields,
            services: serviceOptionsOf(page, t, money),
            noServicesText: t("publicNoServices"),
            days: (today === "" ? [] : pageDays(today)).map((day) => ({ value: day, label: dayText(day) })),
            times: booking.times === null ? null : booking.times.map((iso) => ({ value: iso, label: clock(iso) })),
            labels: publicBookingLabels(t),
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
            ...(result !== null && !succeeded ? { refusal: { message, alternatives } } : {}),
        },
        on: {
            change: booking.change,
            submit: booking.submit,
            again: booking.again,
            pickAlternative: booking.pick,
        },
    }
}

/** Resolves the labels for this form. */
const publicBookingLabels = (t: ReturnType<typeof useTranslations<"workbenchBooking">>) => {
    return {
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
    }
}

/** Resolves service descriptions and formatted prices for the pure form. */
const serviceOptionsOf = (
    page: PublicBookingPageData | null | undefined,
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
    money: (value: number) => string,
) =>
    (page?.services ?? []).map((service) => ({
        value: service.id,
        label: service.name,
        description: [
            t("publicServiceLine", { minutes: service.durationMin }),
            service.priceVnd === null || service.priceVnd === 0 ? "" : money(service.priceVnd),
            service.description,
        ]
            .filter((part) => part !== "")
            .join(" \u00b7 "),
    }))
