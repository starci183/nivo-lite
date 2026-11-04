import { shiftDate } from "@/modules/i18n"
import type { useTranslations } from "next-intl"
import type { PublicBookingAnswer, PublicBookingPageData } from "@/modules/types"
import type { PublicBookingFields } from "./usePublicBooking"

/** How many days ahead the visitor can pick. */
const DAYS_AHEAD = 14

/** The days the page offers, today first. */
export const pageDays = (today: string): ReadonlyArray<string> =>
    Array.from({ length: DAYS_AHEAD }, (_, index) => shiftDate(today, index))

/** What the page shows after a send: the back end answered, or the call itself failed. */
export type PublicBookingResult =
    | { readonly kind: "answered"; readonly answer: PublicBookingAnswer }
    | { readonly kind: "failed"; readonly code: "busy" | "failed" | "offline" }

/** The catalog key of a send that did not reach an answer. */
const failedKeyOf = (code: "busy" | "failed" | "offline"): string => {
    if (code === "busy") return "publicBusy"
    if (code === "offline") return "publicOffline"
    return "publicFailed"
}

/** The catalog key of the message under a result (`code_*` and `public*` of workbenchBooking). */
export const resultKey = (result: PublicBookingResult): string => {
    if (result.kind === "failed") return failedKeyOf(result.code)
    const { answer } = result
    if (answer.code === "busy") return "publicBusy"
    if (answer.code === "") return "publicFailed"
    return `code_${answer.code}`
}

/** The `BOOKINGS_*` refusal codes of the back end as the `code_*` catalog keys the page shows. */
const PUBLIC_CODE_OF_ERROR: Readonly<Record<string, string>> = {
    BOOKINGS_NAME_REQUIRED: "name_required",
    BOOKINGS_PHONE_INVALID: "phone_invalid",
    BOOKINGS_DATETIME_INVALID: "start_invalid",
    BOOKINGS_SERVICE_NOT_FOUND: "service_unavailable",
    BOOKINGS_NO_RESOURCE: "no_resource",
}

/** The `code_*` catalog key of a back end refusal code, or `undefined` for a code the page has no message for. */
export const publicCodeOf = (errorCode: string): string | undefined => PUBLIC_CODE_OF_ERROR[errorCode]

/** The outcome states of a public booking request. */
const BOOKING_STATES = ["confirmed", "waiting", "invalid", "failed"] as const

/** The state of a public booking answer; an unknown state reads as a failure. */
export const bookingStateOf = (state: string): (typeof BOOKING_STATES)[number] =>
    BOOKING_STATES.find((known) => known === state) ?? "failed"

/** The free times to show: `null` while they load, none when they could not be read. */
export const timesOf = <T>(data: { readonly times: T[] } | undefined, error: unknown): T[] | null => {
    if (data !== undefined) return data.times
    return error === undefined ? null : []
}

/** What a send still lacks: the service first, then the time. */
export const lackOf = (fields: PublicBookingFields): "" | "service" | "time" => {
    if (fields.serviceId === "") return "service"
    return fields.start === "" ? "time" : ""
}

/** How the page words a chosen day, a time and a price. */
interface SummaryWords {
    readonly at: string
    readonly day: (date: string) => string
    readonly clock: (iso: string) => string
    readonly money: (value: number) => string
}

/** What the visitor chose in one line: the service, the day and time, the price; empty until a time is chosen. */
export const summaryOf = (
    page: PublicBookingPageData | null | undefined,
    fields: PublicBookingFields,
    words: SummaryWords,
): string => {
    const chosen = (page?.services ?? []).find((service) => service.id === fields.serviceId)
    if (chosen === undefined || fields.start === "") return ""
    return [
        chosen.name,
        `${words.day(fields.date)} ${words.at} ${words.clock(fields.start)}`,
        chosen.priceVnd === null || chosen.priceVnd === 0 ? "" : words.money(chosen.priceVnd),
    ]
        .filter((part) => part !== "")
        .join(" · ")
}

/** The words of the public form, resolved. */
interface PublicBookingCopy {
    readonly step1: string
    readonly step2: string
    readonly step3: string
    readonly finding: string
    readonly noTimes: string
    readonly pickTime: string
    readonly name: string
    readonly phone: string
    readonly email: string
    readonly party: string
    readonly note: string
    readonly notePlaceholder: string
    readonly website: string
    readonly submit: string
    readonly footnote: string
    readonly again: string
    readonly alternatives: string
    readonly previousMonth: string
    readonly nextMonth: string
}

/** One service the form offers. */
interface PublicBookingServiceChoice {
    readonly value: string
    readonly label: string
    readonly description: string
}

/** Resolves the labels for this form. */
export const publicBookingLabels = (t: ReturnType<typeof useTranslations<"workbenchBooking">>): PublicBookingCopy => {
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
        notePlaceholder: t("publicNotePlaceholder"),
        website: t("publicWebsite"),
        submit: t("publicSubmit"),
        footnote: t("publicFootnote"),
        again: t("publicAgain"),
        alternatives: t("publicAlternatives"),
        previousMonth: t("publicPreviousMonth"),
        nextMonth: t("publicNextMonth"),
    }
}

/** Resolves service descriptions and formatted prices for the pure form. */
export const serviceOptionsOf = (
    page: PublicBookingPageData | null | undefined,
    t: ReturnType<typeof useTranslations<"workbenchBooking">>,
    money: (value: number) => string,
): PublicBookingServiceChoice[] =>
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
