import type { Capability } from "@modules/domain/automation-templates"
import type {
    ContextSnapshot,
    GateMode,
    AutomationInstallationRow,
    OverviewRows,
    ShopFacts,
    ShopWithHours,
} from "../automations.contracts"
import { minutesToHhmm, parseHours } from "./hours.policy"

/** The capabilities a pattern can prove; opening hours and due dates have their own tests. */
export type PatternCapability = Exclude<Capability, "has_opening_hours" | "has_due_dates">

/** The capabilities a pattern can prove. */
export const PATTERN_CAPABILITIES: ReadonlyArray<PatternCapability> = [
    "has_deposits",
    "has_appointments",
    "sells_online",
    "has_recurring_contracts",
    "has_delivery",
]

/** The language data the shop reading needs, compiled once from the message catalog. */
export interface ShopPatterns {
    /** The sentences that say the shop has a capability. */
    readonly capabilities: Readonly<Record<PatternCapability, RegExp>>
    /** The sentences that say payment is due later. */
    readonly due: RegExp
    /** The lines that state opening hours. */
    readonly hoursLine: RegExp
    /** The words that deny a statement. */
    readonly negation: RegExp
}

/** The active context versions of the installed modules, read once. */
export interface ActiveContexts {
    /** The installed module keys. */
    readonly installed: ReadonlyArray<string>
    /** The active context version by module. */
    readonly versions: Readonly<Record<string, number>>
    /** All of the context text. */
    readonly text: string
    /** The text of the hours gate, when a context states one. */
    readonly hoursText: string
    /** The operating mode by module. */
    readonly operatingModes: Readonly<Record<string, string | null>>
}

/** What the Sales data shows about the shop. */
export interface SalesFacts {
    /** How many contracts exist. */
    readonly contracts: number
    /** How many orders were shipped. */
    readonly shipped: number
}

/** The active contexts from installation rows (each with its active version embedded). */
export const contextsFrom = (installations: ReadonlyArray<AutomationInstallationRow>): ActiveContexts => {
    const versions: Record<string, number> = {}
    const operatingModes: Record<string, string | null> = {}
    const parts: Array<string> = []
    let hoursText = ""
    for (const row of installations) {
        if (!(row.module_key in operatingModes)) operatingModes[row.module_key] = row.operating_mode
        if (row.ctx === null) continue
        versions[row.module_key] = row.ctx.version
        const snapshot: ContextSnapshot = row.ctx.snapshot
        parts.push(
            snapshot.summary ?? "",
            ...(snapshot.facts ?? []).map((fact) => fact.text),
            ...Object.values(snapshot.gates ?? {}).map((gate) => gate.evidence ?? ""),
        )
        const gateHours = snapshot.gates?.hours_sla?.evidence
        if (gateHours && hoursText === "") hoursText = gateHours
    }
    return {
        installed: installations.map((row) => row.module_key),
        versions,
        text: parts.join("\n"),
        hoursText,
        operatingModes,
    }
}

/** The line of a text that states opening hours, if any. */
const hoursLineOf = (text: string, patterns: ShopPatterns): string | undefined =>
    text.split("\n").find((line) => patterns.hoursLine.test(line) && parseHours(line) !== null)

/** The shop's name, opening hours and tone from rows already read. */
export const shopContextFrom = (
    name: string | null,
    authority: OverviewRows["authority"],
    contexts: ActiveContexts,
    patterns: ShopPatterns,
): ShopWithHours => {
    const range = parseHours(contexts.hoursText) ?? parseHours(hoursLineOf(contexts.text, patterns) ?? "")
    return {
        shop: name ?? "shop",
        hours: range ? `${minutesToHhmm(range.from)} - ${minutesToHhmm(range.to)}` : "",
        tone: (authority?.brand_voice || authority?.reply_style || "").trim(),
        hoursRange: range,
    }
}

/** True when some sentence of the text says the shop HAS the thing: a sentence that negates it does not count. */
const affirms = (text: string, pattern: RegExp, negation: RegExp): boolean =>
    text.split(/[\n.;]/).some((line) => pattern.test(line) && !negation.test(line))

/** What the shop has, derived from its active contexts, its knowledge and its data. */
export const capabilitiesFrom = (
    contexts: ActiveContexts,
    knowledge: OverviewRows["knowledge"],
    dueInvoices: number,
    sales: SalesFacts,
    patterns: ShopPatterns,
): ReadonlySet<Capability> => {
    const text = [
        contexts.text,
        ...knowledge.map((source) => `${source.title}\n${source.content.slice(0, 3000)}`),
    ].join("\n")
    const has = new Set<Capability>()
    for (const capability of PATTERN_CAPABILITIES) {
        if (affirms(text, patterns.capabilities[capability], patterns.negation)) has.add(capability)
    }
    if (contexts.installed.includes("booking")) has.add("has_appointments")
    if (affirms(text, patterns.due, patterns.negation) || dueInvoices > 0) has.add("has_due_dates")
    if (sales.contracts > 0) has.add("has_recurring_contracts")
    if (sales.shipped > 0) has.add("has_delivery")
    if (parseHours(contexts.hoursText) || hoursLineOf(text, patterns) !== undefined) has.add("has_opening_hours")
    return has
}

/** The facts the requirements of a template are checked against. */
export const factsFrom = (
    contexts: ActiveContexts,
    capabilities: ReadonlySet<Capability>,
    connections: ReadonlyArray<{ readonly provider: string; readonly status: string }>,
    chatAgents: number,
): ShopFacts => ({
    installed: contexts.installed,
    capabilities,
    connections,
    hasChat:
        chatAgents > 0 ||
        connections.some((c) => (c.provider === "telegram" || c.provider === "zalo_oa") && c.status !== "pending"),
})

/** The context version a template's body is written from: its module's active version, or (workspace scope) the highest of the installed modules. */
export const contextVersionFor = (
    moduleKey: string | null,
    versions: Readonly<Record<string, number>>,
): number | null => {
    if (moduleKey !== null) return versions[moduleKey] ?? null
    const all = Object.values(versions)
    return all.length > 0 ? Math.max(...all) : null
}

/** The mode of the owner's rule for an action, with the department's operating mode applied: assist turns auto into ask. */
export const gateModeFor = (
    action: string,
    rules: OverviewRows["rules"],
    operatingModes: Readonly<Record<string, string | null>>,
): GateMode => {
    const rule = rules.find((candidate) => candidate.action === action)
    if (rule === undefined) return "never"
    return rule.mode === "auto" && operatingModes[rule.department] === "assist" ? "ask" : rule.mode
}
