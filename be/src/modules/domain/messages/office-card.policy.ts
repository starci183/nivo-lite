import { isRecord } from "@modules/platform/primitives"
import {
    OFFICE_CARD_ACTIONS,
    OFFICE_CARD_SOURCE_LAYERS,
    OFFICE_CARD_TYPES,
    OFFICE_ROOM_KEYS,
} from "./office-cards.contracts"
import type {
    OfficeCard,
    OfficeCardAction,
    OfficeCardCaptions,
    OfficeCardField,
    OfficeCardLine,
    OfficeCardLink,
    OfficeCardMedia,
    OfficeCardParse,
    OfficeCardRef,
    OfficeCardSource,
    OfficeCardType,
    OfficeRoomKey,
} from "./office-cards.contracts"

const KEYS: ReadonlySet<string> = new Set([
    "v",
    "type",
    "title",
    "subtitle",
    "badge",
    "body",
    "fields",
    "media",
    "lines",
    "link",
    "ref",
    "actions",
    "sources",
    "data",
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HREF_PATTERN = /^(https:\/\/|\/(?!\/))/
const MAX_DATA_CHARS = 16_384
const REF_KINDS: ReadonlyArray<OfficeCardRef["kind"]> = ["execution", "work_item"]
const MEDIA_KINDS: ReadonlyArray<OfficeCardMedia["kind"]> = ["image", "video"]
/** A BCP 47 language tag such as vi or vi-VN: a primary language and up to three subtags. */
const LANG_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,3}$/i

/** The reasons found so far; the first one is answered. Readers return a placeholder after noting a reason. */
type Issues = Array<string>

const textOf = (issues: Issues, value: unknown, name: string, max: number): string => {
    if (typeof value === "string" && value.trim() !== "" && value.length <= max) return value
    issues.push(`${name} must be a text of 1..${max} characters`)
    return ""
}

const optionalText = (issues: Issues, value: unknown, name: string, max: number): string | undefined =>
    value === undefined ? undefined : textOf(issues, value, name, max)

const listOf = <T>(
    issues: Issues,
    value: unknown,
    name: string,
    max: number,
    read: (item: unknown, at: string) => T,
): Array<T> => {
    if (Array.isArray(value) && value.length <= max)
        return value.map((item: unknown, index) => read(item, `${name}[${index}]`))
    issues.push(`${name} must be a list of at most ${max}`)
    return []
}

const recordOf = (issues: Issues, value: unknown, name: string): Record<string, unknown> => {
    if (isRecord(value) && !Array.isArray(value)) return value
    issues.push(`${name} must be an object`)
    return {}
}

const hrefOf = (issues: Issues, value: unknown, name: string): string => {
    const href = textOf(issues, value, name, 2000)
    if (href !== "" && !HREF_PATTERN.test(href)) issues.push(`${name} must be https or app-relative`)
    return href
}

/** The card types and actions, widened so an unknown value can be looked up. */
const CARD_TYPE_VALUES: ReadonlyArray<unknown> = OFFICE_CARD_TYPES
const CARD_ACTION_VALUES: ReadonlyArray<unknown> = OFFICE_CARD_ACTIONS

const isCardType = (value: unknown): value is OfficeCardType => CARD_TYPE_VALUES.includes(value)

const isAction = (value: unknown): value is OfficeCardAction => CARD_ACTION_VALUES.includes(value)

const fieldOf =
    (issues: Issues) =>
    (item: unknown, at: string): OfficeCardField => {
        const row = recordOf(issues, item, at)
        return {
            label: textOf(issues, row.label, `${at}.label`, 80),
            value: textOf(issues, row.value, `${at}.value`, 400),
        }
    }

/** The captions of a video: null when it has none, else a WebVTT link and its language (null when not known). */
const captionsOf = (
    issues: Issues,
    value: unknown,
    at: string,
    kind: OfficeCardMedia["kind"],
): OfficeCardCaptions | null => {
    if (value === null) return null
    if (kind !== "video") issues.push(`${at} are only for a video`)
    const row = recordOf(issues, value, at)
    const lang = typeof row.lang === "string" && LANG_PATTERN.test(row.lang) ? row.lang : null
    if (lang === null && row.lang !== undefined && row.lang !== null) issues.push(`${at}.lang must be a language tag`)
    return { url: hrefOf(issues, row.url, `${at}.url`), lang }
}

const mediaOf =
    (issues: Issues) =>
    (item: unknown, at: string): OfficeCardMedia => {
        const row = recordOf(issues, item, at)
        const kind = MEDIA_KINDS.find((candidate) => candidate === row.kind)
        if (kind === undefined) issues.push(`${at}.kind must be image or video`)
        const caption = optionalText(issues, row.caption, `${at}.caption`, 160)
        const media: OfficeCardMedia = { kind: kind ?? "image", url: hrefOf(issues, row.url, `${at}.url`) }
        const captions =
            row.captions === undefined ? undefined : captionsOf(issues, row.captions, `${at}.captions`, media.kind)
        return {
            ...media,
            ...(caption === undefined ? {} : { caption }),
            ...(captions === undefined ? {} : { captions }),
        }
    }

const lineOf =
    (issues: Issues) =>
    (item: unknown, at: string): OfficeCardLine => {
        const row = recordOf(issues, item, at)
        const marker = typeof row.at === "string" && row.at.length <= 40 ? row.at : null
        if (marker === null) issues.push(`${at}.at must be a text of at most 40`)
        return { at: marker ?? "", text: textOf(issues, row.text, `${at}.text`, 400) }
    }

const sourceOf =
    (issues: Issues) =>
    (item: unknown, at: string): OfficeCardSource => {
        const row = recordOf(issues, item, at)
        const layer = OFFICE_CARD_SOURCE_LAYERS.find((candidate) => candidate === row.layer)
        if (layer === undefined) issues.push(`${at}.layer must be 1, 2, 3 or 4`)
        const source: OfficeCardSource = {
            layer: layer ?? 4,
            kind: textOf(issues, row.kind, `${at}.kind`, 40),
            ref: textOf(issues, row.ref, `${at}.ref`, 200),
            label: textOf(issues, row.label, `${at}.label`, 160),
        }
        return row.href === undefined ? source : { ...source, href: hrefOf(issues, row.href, `${at}.href`) }
    }

const linkOf = (issues: Issues, value: unknown): OfficeCardLink => {
    const row = recordOf(issues, value, "link")
    return { label: textOf(issues, row.label, "link.label", 80), href: hrefOf(issues, row.href, "link.href") }
}

const refOf = (issues: Issues, value: unknown): OfficeCardRef => {
    const row = recordOf(issues, value, "ref")
    const kind = REF_KINDS.find((candidate) => candidate === row.kind)
    if (kind === undefined) issues.push("ref.kind must be execution or work_item")
    const id = typeof row.id === "string" && UUID_PATTERN.test(row.id) ? row.id : null
    if (id === null) issues.push("ref.id must be a uuid")
    return { kind: kind ?? "execution", id: id ?? "" }
}

const actionsOf = (issues: Issues, value: unknown, hasRef: boolean): Array<OfficeCardAction> => {
    if (!hasRef) issues.push("actions need a ref")
    return listOf(issues, value, "actions", 3, (item, at) => {
        if (isAction(item)) return item
        issues.push(`${at} is not an action`)
        return "approve"
    })
}

const dataOf = (issues: Issues, value: unknown): Record<string, unknown> => {
    const data = recordOf(issues, value, "data")
    if (JSON.stringify(data).length > MAX_DATA_CHARS) issues.push(`data must be at most ${MAX_DATA_CHARS} characters`)
    return data
}

/** Keeps only the optional parts that are present, so the stored payload carries no undefined keys. */
const present = (parts: Readonly<Record<string, unknown>>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(parts).filter(([, value]) => value !== undefined))

const optional = <T>(value: unknown, read: (value: unknown) => T): T | undefined =>
    value === undefined ? undefined : read(value)

const headOf = (issues: Issues, raw: Record<string, unknown>): OfficeCardType => {
    const unknownKey = Object.keys(raw).find((key) => !KEYS.has(key))
    if (unknownKey !== undefined) issues.push(`unknown key ${unknownKey}`)
    if (raw.v !== 1) issues.push("v must be 1")
    if (isCardType(raw.type)) return raw.type
    issues.push("type is not a card type")
    return "exception"
}

const readCard = (issues: Issues, input: unknown): OfficeCard => {
    const raw = recordOf(issues, input, "card")
    const type = headOf(issues, raw)
    const ref = optional(raw.ref, (value) => refOf(issues, value))
    return {
        v: 1,
        type,
        title: textOf(issues, raw.title, "title", 160),
        ...present({
            subtitle: optionalText(issues, raw.subtitle, "subtitle", 240),
            badge: optionalText(issues, raw.badge, "badge", 40),
            body: optionalText(issues, raw.body, "body", 4000),
            fields: optional(raw.fields, (value) => listOf(issues, value, "fields", 12, fieldOf(issues))),
            media: optional(raw.media, (value) => listOf(issues, value, "media", 6, mediaOf(issues))),
            lines: optional(raw.lines, (value) => listOf(issues, value, "lines", 20, lineOf(issues))),
            link: optional(raw.link, (value) => linkOf(issues, value)),
            ref,
            actions: optional(raw.actions, (value) => actionsOf(issues, value, ref !== undefined)),
            sources: optional(raw.sources, (value) => listOf(issues, value, "sources", 10, sourceOf(issues))),
            data: optional(raw.data, (value) => dataOf(issues, value)),
        }),
    }
}

/** Reads an untrusted payload into a version 1 result card, or the first reason it is not one. */
export const parseOfficeCard = (input: unknown): OfficeCardParse => {
    const issues: Issues = []
    const card = readCard(issues, input)
    const reason = issues[0]
    return reason === undefined ? { ok: true, card } : { ok: false, reason }
}

const ROOM_KEY_VALUES: ReadonlyArray<unknown> = OFFICE_ROOM_KEYS

/** Whether a text is one of the Hub room keys. */
export const isOfficeRoomKey = (value: unknown): value is OfficeRoomKey => ROOM_KEY_VALUES.includes(value)
