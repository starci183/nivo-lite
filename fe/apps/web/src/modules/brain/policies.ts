import type { BrainPoliciesQuery, BrainPolicyQuery } from "@/modules/api"
import type {
    PolicyDurationUnit,
    PolicyFormView,
    PolicyGroupView,
    PolicyHistoryView,
    PolicyRowView,
    PolicyValueKind,
} from "@/modules/types"

/** One rule of the tab as the back end answers it. */
type PolicyRowData = BrainPoliciesQuery["brainPolicies"]["groups"][number]["rows"][number]

/** The state of the derive pass as the back end answers it. */
export type PolicyDerivationData = BrainPoliciesQuery["brainPolicies"]["derivation"]

/** One value of a rule (in force, scheduled, or a version of its history). */
type PolicyValueData = NonNullable<PolicyRowData["current"]>

/** The drawer's read of one rule; null when the fact is no rule. */
export type PolicyDetailData = BrainPolicyQuery["brainPolicy"]

/** The day and the clock the shop's rules are written in. */
export const SHOP_TIME_ZONE = "Asia/Ho_Chi_Minh"

/** The shop's offset, which the start of a chosen day carries on the wire. */
const SHOP_OFFSET = "+07:00"

/** Minutes in an hour and in a day. */
const HOUR = 60
const DAY = 24 * HOUR

/** The resolved words (and the day format) the rows and the drawer are made of. */
export interface PolicyWords {
    readonly unset: string
    readonly noSource: string
    readonly pending: (count: number) => string
    readonly scheduled: (date: string, value: string) => string
    readonly document: (label: string) => string
    readonly chat: (date: string) => string
    readonly learning: (count: number) => string
    readonly owner: (date: string) => string
    readonly manager: (date: string) => string
    readonly readCustomers: string
    readonly readAll: string
    readonly readModules: (names: string) => string
    readonly historyTitle: (value: string, version: number) => string
    readonly historyScheduled: (value: string) => string
    /** The kind of a source alone (document, chat, self-learned, owner edit); the label for any other kind. */
    readonly sourceKind: (kind: string, label: string) => string
    /** "dd/MM" of an instant on the shop's clock; empty for a missing instant. */
    readonly dayMonth: (iso: string | null | undefined) => string
    readonly yes: string
    readonly no: string
}

const KINDS: ReadonlyArray<PolicyValueKind> = ["money", "percent", "duration", "time_range", "boolean", "text"]

/** The control a rule's type picks; an unknown type is edited as text. */
export const policyKindOf = (type: string): PolicyValueKind => KINDS.find((one) => one === type) ?? "text"

/** The start of a chosen day (`yyyy-mm-dd`) on the shop's clock, as the back end reads `validFrom`. */
export const validFromOf = (day: string): string => `${day}T00:00:00${SHOP_OFFSET}`

/** Where a value comes from, in words: the document's title, the chat's day, the answers it was learnt from, the edit's day. */
export const policySourceOf = (source: PolicyValueData["source"], words: PolicyWords): string => {
    const date = words.dayMonth(source.at)
    if (source.kind === "document") return words.document(source.label)
    if (source.kind === "chat") return words.chat(date)
    if (source.kind === "learning") return words.learning(source.count)
    if (source.kind === "owner_edit") return words.owner(date)
    if (source.kind === "manager_edit") return words.manager(date)
    return source.label
}

/** Who reads a value, in words: customers (public), named agents, or every agent of the team. */
export const policyReadersOf = (
    audience: PolicyValueData["audience"],
    words: PolicyWords,
    moduleName: (module: string) => string,
): string => {
    if (audience.customers) return words.readCustomers
    if (audience.modules.length > 0) return words.readModules(audience.modules.map((one) => moduleName(one)).join(", "))
    return words.readAll
}

/** A label written as a sentence starts. */
const sentenceOf = (label: string): string =>
    label === "" ? label : `${label.charAt(0).toLocaleUpperCase("vi")}${label.slice(1)}`

/** What names a rule: the AI's name of it, and the fact's attribute label. */
interface PolicyNamed {
    readonly title: string | null
    readonly attributeLabel: string
}

/** The AI's sentence why a truth is a rule of the shop; undefined when it gave none. */
export const policyReasonOf = (reason: string | null | undefined): string | undefined => {
    const words = reason?.trim() ?? ""
    return words === "" ? undefined : words
}

/** The name of a rule: the name the AI gave it (without its value), else its attribute label, written as a sentence starts. */
export const policyNameOf = (row: PolicyNamed): string =>
    sentenceOf(row.title === null || row.title.trim() === "" ? row.attributeLabel : row.title.trim())

/** The words of the derive pass's notice. */
export interface PolicyDeriveWords {
    readonly derivingTitle: string
    readonly derivingBody: (pendingFacts: number) => string
    readonly failedTitle: string
    /** The sentence of a failure reason (`credits`, else the model gave no usable answer). */
    readonly failedBody: (error: string | null) => string
}

/** What the tab says above its rows about the derive pass: nothing once every truth is judged or before the first pass. */
export const policyNoticeOf = (
    derivation: PolicyDerivationData,
    words: PolicyDeriveWords,
): { readonly kind: "deriving" | "failed"; readonly title: string; readonly body: string } | null => {
    if (derivation.state === "deriving")
        return { kind: "deriving", title: words.derivingTitle, body: words.derivingBody(derivation.pendingFacts) }
    if (derivation.state === "failed")
        return { kind: "failed", title: words.failedTitle, body: words.failedBody(derivation.error) }
    return null
}

/** One rule as a row: the name, the 12 muted line, the value in force (or the unset word), the later value and what waits on it. */
const policyRowViewOf = (
    row: PolicyRowData,
    words: PolicyWords,
    moduleName: (module: string) => string,
): PolicyRowView => {
    const current = row.current
    const line =
        current === null
            ? words.noSource
            : [policySourceOf(current.source, words), policyReadersOf(current.audience, words, moduleName)]
                  .filter((part) => part !== "")
                  .join(" · ")
    return {
        id: row.factId,
        name: policyNameOf(row),
        line,
        value: current === null ? words.unset : current.value,
        scheduled:
            row.scheduled === null
                ? null
                : words.scheduled(words.dayMonth(row.scheduled.validFrom), row.scheduled.value),
        pending: row.pendingCount > 0 ? words.pending(row.pendingCount) : null,
        isUnset: current === null,
    }
}

/** A row with no words: the loading tab draws the ready row from it. */
const blankRowOf = (id: string): PolicyRowView => ({
    id,
    name: "",
    line: "",
    value: "",
    scheduled: null,
    pending: null,
    isUnset: false,
})

/** The groups the loading tab draws: two cards of four and two rows, the shape of a loaded tab. */
export const POLICY_GROUPS_PLACEHOLDER: ReadonlyArray<PolicyGroupView> = [
    { id: "loading-first", label: "", rows: ["a", "b", "c", "d"].map((key) => blankRowOf(`loading-first-${key}`)) },
    { id: "loading-second", label: "", rows: ["a", "b"].map((key) => blankRowOf(`loading-second-${key}`)) },
]

/** The groups of the tab, each under the group the AI derived; a group with no rule is left out. */
export const policyGroupsOf = (
    groups: BrainPoliciesQuery["brainPolicies"]["groups"],
    words: PolicyWords,
    moduleName: (module: string) => string,
): ReadonlyArray<PolicyGroupView> =>
    groups
        .filter((group) => group.rows.length > 0)
        .map((group) => ({
            id: group.subjectKey,
            label: group.subjectLabel,
            rows: group.rows.map((row) => policyRowViewOf(row, words, moduleName)),
        }))

/** A duration in the largest whole unit it fills: 1440 minutes is 1 day, 90 minutes stays 90 minutes. */
const durationPartsOf = (
    minutes: number | null,
): { readonly amount: number | null; readonly unit: PolicyDurationUnit } => {
    if (minutes === null) return { amount: null, unit: "hours" }
    if (minutes > 0 && minutes % DAY === 0) return { amount: minutes / DAY, unit: "days" }
    if (minutes > 0 && minutes % HOUR === 0) return { amount: minutes / HOUR, unit: "hours" }
    return { amount: minutes, unit: "minutes" }
}

const UNIT_MINUTES: Readonly<Record<PolicyDurationUnit, number>> = { minutes: 1, hours: HOUR, days: DAY }

/** The form a value opens with: each control reads its own field, filled from the value's parameter. */
export const policyFormOf = (value: PolicyValueData | null, today: string): PolicyFormView => {
    const parameter = value?.parameter
    const duration = durationPartsOf(parameter?.minutes ?? null)
    return {
        text: parameter?.text ?? value?.value ?? "",
        amount: parameter?.amountVnd ?? null,
        percent: parameter?.percent ?? null,
        duration: duration.amount,
        durationUnit: duration.unit,
        from: parameter?.from ?? "08:00",
        to: parameter?.to ?? "20:00",
        yes: parameter?.yes ?? false,
        customers: value?.audience.customers ?? false,
        effective: "now",
        date: today,
    }
}

/** What a control produced, in the words the back end reads: digits for money, percent and minutes, "07:00–21:00", yes/no, text. */
export const policyValueTextOf = (kind: PolicyValueKind, form: PolicyFormView, words: PolicyWords): string => {
    if (kind === "money") return form.amount === null ? "" : String(Math.round(form.amount))
    if (kind === "percent") return form.percent === null ? "" : String(form.percent)
    if (kind === "duration")
        return form.duration === null ? "" : String(Math.round(form.duration * UNIT_MINUTES[form.durationUnit]))
    if (kind === "time_range") return `${form.from}–${form.to}`
    if (kind === "boolean") return form.yes ? words.yes : words.no
    return form.text.trim()
}

/** The history of a rule: "{value} · version {n}" over its source kind and day; a scheduled value has no version yet. */
export const policyHistoryOf = (
    history: ReadonlyArray<PolicyValueData>,
    words: PolicyWords,
): ReadonlyArray<PolicyHistoryView> =>
    history.map((one, index) => ({
        id: `${one.factId}:${String(index)}`,
        title: one.version === null ? words.historyScheduled(one.value) : words.historyTitle(one.value, one.version),
        line: [words.sourceKind(one.source.kind, one.source.label), words.dayMonth(one.validFrom)]
            .filter((part) => part !== "")
            .join(" · "),
    }))
