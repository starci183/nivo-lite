import { isoWeekday, localDate, localHhmm } from "./zoned-time.policy"

/** What a customer notice says about one booking. */
export interface NoticeFacts {
    /** The shop name. */
    readonly shop: string
    /** The customer name, possibly empty. */
    readonly customer: string
    /** The service name. */
    readonly service: string
    /** The resource (person or room) name, possibly empty. */
    readonly resource: string
    /** The start instant. */
    readonly startMs: number
    /** The time zone of the business. */
    readonly timezone: string
    /** The business address, possibly empty. */
    readonly address: string
    /** The deposit in VND, 0 when none. */
    readonly depositVnd: number
    /** The hours before the start up to which a change is free. */
    readonly cancelWindowHours: number
    /** The start the booking was moved from, or null. */
    readonly fromMs: number | null
    /** The fee owed, 0 when none. */
    readonly feeVnd: number
}

/** Looks up a text of the catalog by key. */
export type Say = (key: string, params?: Readonly<Record<string, string | number>>) => string

/** The parts of an instant a notice writes out: the clock time, the ISO weekday (1 to 7) and the date numbers. */
export interface WhenParts {
    /** `HH:MM`. */
    readonly time: string
    /** 1 is Monday and 7 is Sunday. */
    readonly weekday: number
    /** Day of the month, two digits. */
    readonly day: string
    /** Month, two digits. */
    readonly month: string
    /** Year. */
    readonly year: string
}

/** The parts of an instant in the zone of the business. */
export const whenParts = (ms: number, timezone: string): WhenParts => {
    const date = localDate(ms, timezone)
    return {
        time: localHhmm(ms, timezone),
        weekday: isoWeekday(date),
        year: date.slice(0, 4),
        month: date.slice(5, 7),
        day: date.slice(8, 10),
    }
}

/** The code point of the dong sign. */
const DONG_SIGN = 0x20ab

/** An amount in dong the way the shop reads it: the number in Vietnamese grouping, a space and the dong sign. */
export const vndText = (amount: number): string =>
    `${new Intl.NumberFormat("vi-VN").format(amount)} ${String.fromCodePoint(DONG_SIGN)}`

/** The instant as the customer reads it: the time, the weekday name and the date, in the zone of the business. */
export const whenText = (t: Say, ms: number, timezone: string): string => {
    const parts = whenParts(ms, timezone)
    return t("bookings.notice.when", {
        time: parts.time,
        weekday: t(`bookings.weekday.${parts.weekday}`),
        day: parts.day,
        month: parts.month,
        year: parts.year,
    })
}

/** The name a greeting uses: the customer's, or a neutral word. */
const nameOf = (t: Say, facts: NoticeFacts): string => facts.customer.trim() || t("bookings.notice.nameFallback")

/** The resource in brackets after a time, or nothing. */
const resourceOf = (t: Say, facts: NoticeFacts): string =>
    facts.resource === "" ? "" : t("bookings.notice.resource", { resource: facts.resource })

/** The text that confirms a booking: what, when, where, the deposit and the free-change window. */
export const confirmedText = (t: Say, facts: NoticeFacts): string =>
    [
        t("bookings.notice.confirmed", {
            customer: nameOf(t, facts),
            shop: facts.shop,
            service: facts.service,
            when: whenText(t, facts.startMs, facts.timezone),
            resource: resourceOf(t, facts),
        }),
        facts.address === "" ? "" : t("bookings.notice.address", { address: facts.address }),
        facts.depositVnd > 0
            ? t("bookings.notice.deposit", { deposit: vndText(facts.depositVnd), shop: facts.shop })
            : "",
        facts.cancelWindowHours > 0 ? t("bookings.notice.window", { hours: facts.cancelWindowHours }) : "",
    ]
        .filter((part) => part !== "")
        .join(" ")

/** The text that says a booking moved, from when to when. */
export const movedText = (t: Say, facts: NoticeFacts): string =>
    t("bookings.notice.moved", {
        customer: nameOf(t, facts),
        shop: facts.shop,
        service: facts.service,
        from: whenText(t, facts.fromMs ?? facts.startMs, facts.timezone),
        when: whenText(t, facts.startMs, facts.timezone),
        resource: resourceOf(t, facts),
    })

/** The text that says a booking was cancelled, with the late-cancel fee when one is owed. */
export const cancelledText = (t: Say, facts: NoticeFacts): string =>
    t("bookings.notice.cancelled", {
        customer: nameOf(t, facts),
        shop: facts.shop,
        service: facts.service,
        when: whenText(t, facts.startMs, facts.timezone),
        fee: facts.feeVnd > 0 ? t("bookings.notice.cancelFee", { fee: vndText(facts.feeVnd) }) : "",
    })

/** The text that says the customer did not come, and the fee. */
export const noShowText = (t: Say, facts: NoticeFacts): string =>
    t("bookings.notice.noShow", {
        customer: nameOf(t, facts),
        shop: facts.shop,
        service: facts.service,
        when: whenText(t, facts.startMs, facts.timezone),
        fee: vndText(facts.feeVnd),
    })

/** The fixed reminder: what, when, how long is left, and where. */
export const reminderText = (t: Say, facts: NoticeFacts, hoursBefore: number): string =>
    t("bookings.notice.reminder", {
        customer: nameOf(t, facts),
        shop: facts.shop,
        service: facts.service,
        when: whenText(t, facts.startMs, facts.timezone),
        resource: resourceOf(t, facts),
        left: hoursBefore >= 1 ? t("bookings.notice.reminderLeft", { hours: hoursBefore }) : "",
        address: facts.address === "" ? "" : t("bookings.notice.reminderAddress", { address: facts.address }),
    })

/** The variables an owner's own reminder wording may use, by the names the template offers. */
export const reminderVariables = (t: Say, facts: NoticeFacts): Readonly<Record<string, string>> => ({
    ten_khach: facts.customer,
    ten_shop: facts.shop,
    dich_vu: facts.service,
    gio_hen: whenText(t, facts.startMs, facts.timezone),
    nguoi_lam: facts.resource,
    dia_chi: facts.address,
})

/** The neutral words a blank variable of the reminder reads as. */
export const REMINDER_NEUTRAL: ReadonlyArray<string> = [
    "ten_khach",
    "ten_shop",
    "dich_vu",
    "gio_hen",
    "nguoi_lam",
    "dia_chi",
]

/**
 * Fills the `{name}` blanks of the owner's reminder wording; a blank value reads as its neutral word, and spaces left
 * before punctuation are tidied.
 */
export const fillReminderBody = (
    body: string,
    variables: Readonly<Record<string, string>>,
    neutral: Readonly<Record<string, string>>,
): string =>
    body
        .replace(/\{([a-z_]+)\}/g, (_whole, name: string) => (variables[name] ?? "").trim() || (neutral[name] ?? ""))
        .replace(/[ \t]{2,}/g, " ")
        .replace(/[ \t]([.,!?])/g, "$1")
        .trim()
