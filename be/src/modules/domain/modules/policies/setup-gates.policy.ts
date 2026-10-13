import type { VersionSnapshot, DraftSnapshot, GateEntry, GateEvidence } from "@modules/domain/module-context-versions"
import type { AgentTexts } from "@modules/domain/agents"
import type { Locale } from "@modules/platform/i18n"
import type { ModuleDefinition, ModuleGate } from "../modules.contracts"

const BLOCK_END = "### end NIVO setup"
const BLOCK_PATTERN = /\n*### NIVO setup[\s\S]*?### end NIVO setup\s*/gu

/** What the owner does to a gate of the draft. */
export type GateAction = "confirm" | "reopen" | "edit"

/** The state of a gate, a missing one when nothing was said about it. */
export const gateEntry = (evidence: GateEvidence, key: string): GateEntry =>
    evidence[key] ?? { status: "missing", evidence: "" }

/** True when every gate of the module is confirmed. */
export const allGatesConfirmed = (module: ModuleDefinition, evidence: GateEvidence): boolean =>
    module.gates.every((gate) => gateEntry(evidence, gate.key).status === "confirmed")

/** The title of a gate in the language of the reader. */
export const gateLabelOf = (gate: ModuleGate, locale: Locale): string =>
    locale === "vi" ? gate.label_vi : gate.label_en

/** What a version freezes from a draft: the summary, the facts and the confirmed gates only. */
export const snapshotOf = (draft: DraftSnapshot, gates: GateEvidence): VersionSnapshot => ({
    summary: draft.summary,
    facts: draft.facts,
    gates: Object.fromEntries(Object.entries(gates).filter(([, gate]) => gate.status === "confirmed")),
})

const entryText = (entry: GateEntry | undefined): string =>
    entry === undefined
        ? ""
        : [entry.status, entry.evidence, entry.confirmed_by ?? "", entry.confirmed_at ?? ""].join("\u0000")

/** True when two snapshots say the same thing, whatever the order of their keys. */
export const sameSnapshot = (left: VersionSnapshot, right: VersionSnapshot): boolean => {
    const keys = [...new Set([...Object.keys(left.gates), ...Object.keys(right.gates)])]
    return (
        left.summary === right.summary &&
        left.facts.length === right.facts.length &&
        left.facts.every((fact, at) => fact.key === right.facts[at]?.key && fact.text === right.facts[at]?.text) &&
        keys.every((key) => entryText(left.gates[key]) === entryText(right.gates[key]))
    )
}

/** The gate after the owner confirmed, reopened or edited it; null when confirming or editing has no evidence to stand on. */
export const gateAfter = (
    action: GateAction,
    current: GateEntry,
    typed: string,
    confirmedBy: string,
    at: Date,
): GateEntry | null => {
    const evidence = action === "edit" ? typed : current.evidence
    if (action === "reopen") return { status: "proposed", evidence }
    if (evidence === "") return null
    return { status: "confirmed", evidence, confirmed_by: confirmedBy, confirmed_at: at.toISOString() }
}

/** The block written into the agent: behaviour rules into its instructions, business knowledge into its knowledge. */
export const agentTextsOf = (
    module: ModuleDefinition,
    snapshot: VersionSnapshot,
    version: number,
    locale: Locale,
): AgentTexts => {
    const rules = module.gates
        .map((gate) => `- ${gateLabelOf(gate, locale)}: ${gateEntry(snapshot.gates, gate.key).evidence}`)
        .join("\n")
    const facts = snapshot.facts.map((fact) => `- ${fact.text}`).join("\n")
    const head = `### NIVO setup v${version}`
    return {
        instructions: `${head}\nConfirmed by the owner. Follow these rules exactly; when something is not covered, say a team member will confirm.\n${rules}\n${BLOCK_END}`,
        knowledge: `${head}\n${snapshot.summary}\n${facts}\n${rules}\n${BLOCK_END}`,
    }
}

/** An agent text without the setup block of an earlier version. */
export const stripSetupBlock = (value: string): string => value.replace(BLOCK_PATTERN, "").trimEnd()
