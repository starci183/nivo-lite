import type { useQueryProviderOfferSwr } from "@/hooks/swr"
import type { ProviderDocEntryView, ProviderDocGroupView, ProviderDocMemberView } from "@/modules/types"

/** The documentation of one connected account's provider, as the back end answers it. */
export type ProviderOffer = Exclude<ReturnType<typeof useQueryProviderOfferSwr>["data"], undefined>

type Read = ProviderOffer["api"][number]
type Tool = ProviderOffer["mcp"][number]
type Trigger = ProviderOffer["triggers"][number]
type Member = Read["parameters"][number]
type Words = { readonly vi: string; readonly en: string }

/** The resolved words an entry needs from the catalog: the kind chips, the group headings, the freshness and the trigger lines. */
export interface ProviderOfferWords {
    readonly kinds: Readonly<Record<string, string>>
    readonly groupParameters: string
    readonly groupReturnsRow: string
    readonly groupReturns: string
    readonly groupPayload: string
    readonly freshness: Readonly<Record<string, string>>
    readonly batchingEach: string
    readonly batchingList: (maxEvents: number) => string
    readonly batchingListOpen: string
    readonly recoveryYes: string
    readonly recoveryNo: string
    /** The closed map of the JSON type names the API returns (`string`, `integer`, `null`, `id`, `choice`...) to words. */
    readonly types: Readonly<Record<string, string>>
    /** The closed map of the JSON formats the API returns (`uuid`, `date-time`...) to words. */
    readonly formats: Readonly<Record<string, string>>
    readonly typeArrayOf: (item: string) => string
    /** The effect marks of a write (`money`, `irreversible`) as words on a chip; any other value draws nothing. */
    readonly effects: Readonly<Record<string, string>>
    /** Why a Swagger tool cannot be called, by its state (`missing`, `unsupported`, `mode_mismatch`). */
    readonly states: Readonly<Record<string, string>>
    readonly filterable: string
}

/** The registry's words in the reader's language; null when the registry declares none (never an invented line). */
export const registryWordsOf = (words: Words | null, locale: string): string | null => {
    if (words === null) return null
    return locale === "en" ? words.en : words.vi
}

/** One type name in words: `array<x>` says its item, a union (`string|null`) says each part, an unknown name stays as it is. */
const typeWordOf = (words: ProviderOfferWords, name: string): string => {
    const array = /^array<(.+)>$/.exec(name)
    if (array?.[1] !== undefined) return words.typeArrayOf(typeWordOf(words, array[1]))
    if (!name.includes("|")) return words.types[name] ?? name
    return name
        .split("|")
        .map((part) => typeWordOf(words, part))
        .join(" | ")
}

/**
 * A member's declared type in words: its closed choices joined (`in | out`); else its format's word when the map has one (`uuid`,
 * `date-time`), else its type's word with an unknown format as it is; nothing when the schema declares none.
 */
const typeOf = (words: ProviderOfferWords, member: Member): string => {
    if (member.choices.length > 0) return member.choices.join(" | ")
    const format = member.format === null || member.format === "" ? null : member.format
    if (format !== null && words.formats[format] !== undefined) return words.formats[format]
    const type = member.type === null || member.type === "" ? null : typeWordOf(words, member.type)
    return [type, format].filter((part): part is string => part !== null).join(" · ")
}

/** One member as a row: the bilingual label when the registry has one, else the single-language description. */
const memberOf =
    (words: ProviderOfferWords, locale: string, groupId: string) =>
    (member: Member): ProviderDocMemberView => ({
        id: `${groupId}:${member.name}`,
        name: member.name,
        type: typeOf(words, member),
        choices: member.choices,
        meaning: [registryWordsOf(member.label, locale) ?? member.description ?? "", member.filterable ? words.filterable : ""]
            .filter((part) => part !== "")
            .join(" · "),
    })

/** The member groups that have members, in order. */
const groupsOf = (
    words: ProviderOfferWords,
    locale: string,
    groups: ReadonlyArray<{ readonly id: string; readonly label: string; readonly members: ReadonlyArray<Member> }>,
): ReadonlyArray<ProviderDocGroupView> =>
    groups
        .filter((group) => group.members.length > 0)
        .map((group) => ({ id: group.id, label: group.label, rows: group.members.map(memberOf(words, locale, group.id)) }))

/** The kind chip's word, or the raw kind when the vocabulary has none. */
const kindOf = (kinds: Readonly<Record<string, string>>, kind: string): string => kinds[kind] ?? kind

/** Level 1: the reads a screen calls; a `page` read returns rows, any other shape one record. */
export const apiEntriesOf = (
    offer: ProviderOffer,
    words: ProviderOfferWords,
    locale: string,
): ReadonlyArray<ProviderDocEntryView> =>
    offer.api.map((read: Read) => ({
        id: read.name,
        name: read.name,
        kindLabel: kindOf(words.kinds, read.kind),
        summary: registryWordsOf(read.summary, locale),
        fact: words.freshness[read.freshness] ?? null,
        groups: groupsOf(words, locale, [
            { id: "parameters", label: words.groupParameters, members: read.parameters },
            {
                id: "returns",
                label: read.shape === "page" ? words.groupReturnsRow : words.groupReturns,
                members: read.returns,
            },
        ]),
        note: null,
        marks: [],
        line: null,
        stateNote: null,
    }))

/** The chips of a tool that says what it does: its effect as words when one is marked. */
const marksOf = (words: ProviderOfferWords, tool: Tool): ReadonlyArray<string> => {
    const marks: string[] = []
    const effect = tool.effect === null ? undefined : words.effects[tool.effect]
    if (effect !== undefined) marks.push(effect)
    return marks
}

/** Why a Swagger tool cannot be called now: its state's words and the names of what the operation uses that is unsupported; null when ready. */
const stateNoteOf = (words: ProviderOfferWords, tool: Tool): string | null => {
    const operation = tool.operation
    if (operation === null || operation.state === "ready") return null
    const reason = words.states[operation.state] ?? operation.state
    return operation.unsupported.length === 0 ? reason : `${reason}: ${operation.unsupported.join(", ")}`
}

/** Level 2: the tools an agent calls; the title and summary only where a registry declares them. */
export const mcpEntriesOf = (
    offer: ProviderOffer,
    words: ProviderOfferWords,
    locale: string,
): ReadonlyArray<ProviderDocEntryView> =>
    offer.mcp.map((tool: Tool) => ({
        id: tool.id,
        name: tool.id,
        kindLabel: kindOf(words.kinds, tool.kind),
        summary: registryWordsOf(tool.summary, locale) ?? registryWordsOf(tool.title, locale),
        fact: null,
        groups: groupsOf(words, locale, [
            { id: "parameters", label: words.groupParameters, members: tool.parameters },
            { id: "returns", label: words.groupReturns, members: tool.returns },
        ]),
        note: null,
        marks: marksOf(words, tool),
        line: lineOf(tool.operation),
        stateNote: stateNoteOf(words, tool),
    }))

/** The method and path line of a tool's operation; null when it has none or names no method. */
const lineOf = (operation: Tool["operation"]): string | null => {
    const method = operation?.method ?? null
    return method === null ? null : `${method} ${operation?.path ?? ""}`.trim()
}

/** The batching line of a trigger: each event alone, or a list with its open or bounded size. */
const batchingOf = (words: ProviderOfferWords, batching: Trigger["batching"]): string => {
    if (batching.mode === "each") return words.batchingEach
    return batching.maxEvents === null ? words.batchingListOpen : words.batchingList(batching.maxEvents)
}

/** Level 3: the events a workflow subscribes to, with the batching and recovery line the drawing puts under the table. */
export const triggerEntriesOf = (
    offer: ProviderOffer,
    words: ProviderOfferWords,
    locale: string,
): ReadonlyArray<ProviderDocEntryView> =>
    offer.triggers.map((trigger: Trigger) => {
        const batching = batchingOf(words, trigger.batching)
        return {
            id: trigger.name,
            name: trigger.name,
            kindLabel: kindOf(words.kinds, trigger.kind),
            summary: registryWordsOf(trigger.summary, locale),
            fact: null,
            groups: groupsOf(words, locale, [{ id: "payload", label: words.groupPayload, members: trigger.payload }]),
            note: `${batching} ${trigger.recovery === "none" ? words.recoveryNo : words.recoveryYes}`,
            marks: [],
            line: null,
            stateNote: null,
        }
    })
