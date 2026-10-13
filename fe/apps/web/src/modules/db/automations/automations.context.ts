import type { Capability, ShopContext } from "@/lib/automation-shared"
import { minutesToHhmm, parseHours } from "./automations.hours"
import type { HoursRange } from "./automations.hours"
import type { InstallationRow, OverviewRows, RuleRow } from "./automations.rows"

/** The capabilities a pattern can prove; opening hours and due dates have their own tests. */
export type PatternCapability = Exclude<Capability, "has_opening_hours" | "has_due_dates">

/** The capabilities a pattern can prove. */
const PATTERN_CAPABILITIES: ReadonlyArray<PatternCapability> = [
    "has_deposits",
    "has_appointments",
    "sells_online",
    "has_recurring_contracts",
    "has_delivery",
]

/** The language data that reads a shop, compiled from the message catalogue. */
export interface ShopPatterns {
    readonly capabilities: Readonly<Record<PatternCapability, RegExp>>
    readonly due: RegExp
    readonly hoursLine: RegExp
    readonly negation: RegExp
}

/** The active context of the installed modules, read once. */
export interface ActiveContexts {
    readonly installed: ReadonlyArray<string>
    readonly versions: Readonly<Record<string, number>>
    readonly text: string
    readonly hoursText: string
    readonly operatingModes: Readonly<Record<string, string | null>>
}

/** What the facts of a shop say, for the requirements of the templates. */
export interface ShopFacts {
    readonly installed: ReadonlyArray<string>
    readonly capabilities: ReadonlySet<Capability>
    readonly hasChat: boolean
    readonly connections: ReadonlyArray<{ readonly provider: string; readonly status: string }>
}

/** The shop with its opening window as numbers. */
export interface ShopWithHours extends ShopContext {
    readonly hoursRange: HoursRange | null
}

/** The active contexts from installation rows (each with its active version embedded). */
export const contextsFrom = (installations: ReadonlyArray<InstallationRow>): ActiveContexts => {
    const versions: Record<string, number> = {}
    const operatingModes: Record<string, string | null> = {}
    const parts: Array<string> = []
    let hoursText = ""
    for (const row of installations) {
        if (!(row.module_key in operatingModes)) operatingModes[row.module_key] = row.operating_mode
        if (row.ctx === null) continue
        versions[row.module_key] = row.ctx.version
        const snapshot = row.ctx.snapshot
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

const affirms = (text: string, pattern: RegExp, negation: RegExp): boolean =>
    text.split(/[\n.;]/).some((line) => pattern.test(line) && !negation.test(line))

/** What the shop has, derived from its active contexts, its knowledge and its data. */
export const capabilitiesFrom = (
    rows: OverviewRows,
    contexts: ActiveContexts,
    patterns: ShopPatterns,
): ReadonlySet<Capability> => {
    const text = [
        contexts.text,
        ...rows.knowledge.map((source) => `${source.title}\n${source.content.slice(0, 3000)}`),
    ].join("\n")
    const has = new Set<Capability>()
    for (const capability of PATTERN_CAPABILITIES) {
        if (affirms(text, patterns.capabilities[capability], patterns.negation)) has.add(capability)
    }
    if (contexts.installed.includes("booking")) has.add("has_appointments")
    if (affirms(text, patterns.due, patterns.negation) || rows.due_invoices > 0) has.add("has_due_dates")
    if (rows.contracts > 0) has.add("has_recurring_contracts")
    if (rows.shipped_orders > 0) has.add("has_delivery")
    if (parseHours(contexts.hoursText) || hoursLineOf(text, patterns) !== undefined) has.add("has_opening_hours")
    return has
}

/** The facts the requirements of a template are checked against. */
export const factsFrom = (
    rows: OverviewRows,
    contexts: ActiveContexts,
    capabilities: ReadonlySet<Capability>,
): ShopFacts => ({
    installed: contexts.installed,
    capabilities,
    connections: rows.connections,
    hasChat:
        rows.chat_agents > 0 ||
        rows.connections.some(
            (connection) =>
                (connection.provider === "telegram" || connection.provider === "zalo_oa") &&
                connection.status !== "pending",
        ),
})

/** The context version a template's body is written from: its module's active version, or the highest of the installed modules. */
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
    rules: ReadonlyArray<RuleRow>,
    operatingModes: Readonly<Record<string, string | null>>,
): "auto" | "ask" | "never" => {
    const rule = rules.find((candidate) => candidate.action === action)
    if (rule === undefined) return "never"
    return rule.mode === "auto" && operatingModes[rule.department] === "assist" ? "ask" : rule.mode
}
