import type { BadgeTone } from "@starci/grammar/common"

/** The channels a customer may come in on, in the order the filter lists them. */
export const INBOX_CHANNELS: ReadonlyArray<string> = ["zalo", "telegram", "facebook", "instagram", "website", "bank"]

/** The orders the list can be read in. */
export const INBOX_SORTS: ReadonlyArray<string> = ["recent", "oldest", "name", "amount"]

/** The tabs of the list, in order. */
export const INBOX_TABS: ReadonlyArray<string> = ["all", "new", "needs_you", "ordered", "paid"]

/** The catalog key of each tab's words. */
export const TAB_WORDS: Readonly<Record<string, string>> = {
    all: "tabAll",
    new: "tabNew",
    needs_you: "tabNeeds",
    ordered: "tabOrdered",
    paid: "tabPaid",
}

/** The catalog key of each order's words. */
export const SORT_WORDS: Readonly<Record<string, string>> = {
    recent: "sortRecent",
    oldest: "sortOldest",
    name: "sortName",
    amount: "sortAmount",
}

/** The stages of a customer, in order: the steps of the stepper. */
export const INBOX_STAGES: ReadonlyArray<string> = ["new", "consulting", "ordered", "paid", "done"]

/** The value of a select that stands for every option. */
export const ALL_OPTION = "all"

/** The tone each mark of a lead row wears; a mark that is not listed is neutral. */
const CHIP_TONES: Readonly<Record<string, BadgeTone>> = {
    new: "accent",
    needs_you: "danger",
    awaiting_payment: "warning",
    paid: "success",
    unmatched: "warning",
}

/** The tone of one mark of a lead row. */
export const chipToneOf = (key: string): BadgeTone => CHIP_TONES[key] ?? "neutral"

/** The position of a stage in the stepper; an unknown stage is the first. */
export const stageIndexOf = (stage: string): number => Math.max(0, INBOX_STAGES.indexOf(stage))

/** The part of the day an instant falls in, against `now`, in the local calendar. */
export const sectionOf = (iso: string, now: Date): "today" | "yesterday" | "earlier" => {
    const day = (value: Date): number => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
    const gap = Math.round((day(now) - day(new Date(iso))) / 86_400_000)
    if (gap <= 0) return "today"
    return gap === 1 ? "yesterday" : "earlier"
}

/** A phone number with its middle hidden (the first two and last three digits stay), as the owner reads it in a list; too short a number stays whole. */
export const maskedPhoneOf = (phone: string): string => {
    const digits = phone.replace(/\D/g, "")
    return digits.length < 7 ? phone : `${digits.slice(0, 2)}\u2022\u2022 \u2022\u2022\u2022 ${digits.slice(-3)}`
}

/** The initials-free key a channel's words are filed under; a channel the catalog does not know is the website. */
export const channelKeyOf = (channel: string): string => (INBOX_CHANNELS.includes(channel) ? channel : "website")

/** The embed snippet of the website form: an iframe that shows the hosted form inside the page of the shop. */
export const embedSnippetOf = (formUrl: string): string =>
    `<iframe src="${formUrl}" width="100%" height="460" loading="lazy" style="border:0"></iframe>`
