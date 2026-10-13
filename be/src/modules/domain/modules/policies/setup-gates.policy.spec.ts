import type {
    DraftSnapshot,
    GateEntry,
    GateEvidence,
    SetupFact,
    VersionSnapshot,
} from "@modules/domain/module-context-versions"
import type { ModuleDefinition, ModuleGate } from "../modules.contracts"
import {
    agentTextsOf,
    allGatesConfirmed,
    gateAfter,
    gateEntry,
    gateLabelOf,
    sameSnapshot,
    snapshotOf,
    stripSetupBlock,
} from "./setup-gates.policy"

const text = { vi: "v", en: "e" }
const list = { vi: ["v"], en: ["e"] }
const AT = new Date("2026-10-12T10:00:00.000Z")

const gateOf = (key: string): ModuleGate => ({
    key,
    label_vi: `${key}-vi`,
    label_en: `${key}-en`,
    hint_vi: "h",
    hint_en: "h",
})

const moduleOf = (gates: ReadonlyArray<ModuleGate>): ModuleDefinition => ({
    key: "demo",
    order: 1,
    name: text,
    shortName: text,
    description: text,
    points: list,
    purpose: "Demo.",
    icon: "bolt",
    glyph: "M0 0",
    mascot: "/m.png",
    category: "ops",
    status: "stable",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "demo",
    workbench: null,
    settingsExtras: null,
    requires: { capabilities: [], connections: [] },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    agent: { name: "Demo", handle: "demo", summary: text, capabilities: list, role: text, instructions: text },
    gates,
    authorityActions: [],
    accepts: [],
})

const confirmed = (evidence: string, by = "Lan"): GateEntry => ({
    status: "confirmed",
    evidence,
    confirmed_by: by,
    confirmed_at: AT.toISOString(),
})

const draft: DraftSnapshot = { summary: "Tea shop", facts: [{ key: "city", text: "Hue" }] }

const snapshot: VersionSnapshot = {
    summary: "Tea shop",
    facts: [{ key: "city", text: "Hue" }],
    gates: { tone: confirmed("warm") },
}

describe("gateEntry", () => {
    it("reads the gate that was stored", () => {
        const evidence: GateEvidence = { tone: { status: "proposed", evidence: "warm" } }

        expect(gateEntry(evidence, "tone")).toEqual({ status: "proposed", evidence: "warm" })
    })

    it("reads a missing gate as missing", () => {
        expect(gateEntry({}, "tone")).toEqual({ status: "missing", evidence: "" })
    })
})

describe("allGatesConfirmed", () => {
    const module = moduleOf([gateOf("tone"), gateOf("hours")])

    it("is true when every gate is confirmed", () => {
        const evidence: GateEvidence = { tone: confirmed("warm"), hours: confirmed("8-5") }

        expect(allGatesConfirmed(module, evidence)).toBe(true)
    })

    it("is true when the module has no gates", () => {
        expect(allGatesConfirmed(moduleOf([]), {})).toBe(true)
    })

    it("is false when a gate is still open", () => {
        const evidence: GateEvidence = { tone: confirmed("warm"), hours: { status: "proposed", evidence: "8-5" } }

        expect(allGatesConfirmed(module, evidence)).toBe(false)
    })
})

describe("gateLabelOf", () => {
    const gate = gateOf("tone")

    it("uses the Vietnamese title", () => {
        expect(gateLabelOf(gate, "vi")).toBe("tone-vi")
    })

    it("uses the English title", () => {
        expect(gateLabelOf(gate, "en")).toBe("tone-en")
    })
})

describe("snapshotOf", () => {
    it("keeps the confirmed gates only", () => {
        const evidence: GateEvidence = {
            tone: confirmed("warm"),
            hours: { status: "proposed", evidence: "8-5" },
        }

        expect(snapshotOf(draft, evidence)).toEqual({
            summary: "Tea shop",
            facts: [{ key: "city", text: "Hue" }],
            gates: { tone: confirmed("warm") },
        })
    })
})

describe("sameSnapshot", () => {
    it("matches snapshots that say the same thing in a different key order", () => {
        const right: VersionSnapshot = {
            summary: "Tea shop",
            facts: [{ key: "city", text: "Hue" }],
            gates: { hours: confirmed("8-5"), tone: confirmed("warm") },
        }
        const left: VersionSnapshot = {
            ...snapshot,
            gates: { tone: confirmed("warm"), hours: confirmed("8-5", "Lan") },
        }

        expect(sameSnapshot(left, right)).toBe(true)
    })

    it("matches gates that were confirmed without a name or a time", () => {
        const plain: GateEntry = { status: "confirmed", evidence: "warm" }
        const left: VersionSnapshot = { ...snapshot, gates: { tone: plain } }
        const right: VersionSnapshot = { ...snapshot, gates: { tone: plain } }

        expect(sameSnapshot(left, right)).toBe(true)
    })

    it("rejects a different summary", () => {
        expect(sameSnapshot(snapshot, { ...snapshot, summary: "Coffee" })).toBe(false)
    })

    it("rejects a different number of facts", () => {
        expect(sameSnapshot(snapshot, { ...snapshot, facts: [] })).toBe(false)
    })

    it("rejects a fact with a different key", () => {
        expect(sameSnapshot(snapshot, { ...snapshot, facts: [{ key: "town", text: "Hue" }] })).toBe(false)
    })

    it("rejects a fact with a different text", () => {
        expect(sameSnapshot(snapshot, { ...snapshot, facts: [{ key: "city", text: "Da Nang" }] })).toBe(false)
    })

    it("rejects a fact the other snapshot does not have at that place", () => {
        const hole: Array<SetupFact> = [
            { key: "city", text: "Hue" },
            { key: "hours", text: "8-5" },
        ]
        delete hole[1]
        const full: ReadonlyArray<SetupFact> = [
            { key: "city", text: "Hue" },
            { key: "hours", text: "8-5" },
        ]

        expect(sameSnapshot({ ...snapshot, facts: full }, { ...snapshot, facts: hole })).toBe(false)
    })

    it("rejects a gate the other snapshot does not have", () => {
        expect(sameSnapshot(snapshot, { ...snapshot, gates: {} })).toBe(false)
    })

    it("rejects a gate that was confirmed by someone else", () => {
        expect(sameSnapshot(snapshot, { ...snapshot, gates: { tone: confirmed("warm", "Minh") } })).toBe(false)
    })
})

describe("gateAfter", () => {
    const current: GateEntry = confirmed("warm")

    it("reopens a gate as proposed, even when its evidence is empty", () => {
        expect(gateAfter("reopen", { status: "confirmed", evidence: "" }, "ignored", "Lan", AT)).toEqual({
            status: "proposed",
            evidence: "",
        })
    })

    it("confirms the current evidence", () => {
        expect(gateAfter("confirm", { status: "proposed", evidence: "warm" }, "ignored", "Lan", AT)).toEqual(current)
    })

    it("refuses to confirm a gate with no evidence", () => {
        expect(gateAfter("confirm", { status: "missing", evidence: "" }, "ignored", "Lan", AT)).toBeNull()
    })

    it("confirms the text the owner typed", () => {
        expect(gateAfter("edit", current, "formal", "Minh", AT)).toEqual(confirmed("formal", "Minh"))
    })

    it("refuses to edit a gate down to empty text", () => {
        expect(gateAfter("edit", current, "", "Minh", AT)).toBeNull()
    })
})

describe("agentTextsOf", () => {
    const module = moduleOf([gateOf("tone"), gateOf("hours")])
    const head = "### NIVO setup v3"
    const rulesVi = "- tone-vi: warm\n- hours-vi: "
    const rulesEn = "- tone-en: warm\n- hours-en: "
    const promise =
        "Confirmed by the owner. Follow these rules exactly; when something is not covered, say a team member will confirm."

    it("writes the Vietnamese block", () => {
        expect(agentTextsOf(module, snapshot, 3, "vi")).toEqual({
            instructions: `${head}\n${promise}\n${rulesVi}\n### end NIVO setup`,
            knowledge: `${head}\nTea shop\n- Hue\n${rulesVi}\n### end NIVO setup`,
        })
    })

    it("writes the English block", () => {
        expect(agentTextsOf(module, snapshot, 3, "en")).toEqual({
            instructions: `${head}\n${promise}\n${rulesEn}\n### end NIVO setup`,
            knowledge: `${head}\nTea shop\n- Hue\n${rulesEn}\n### end NIVO setup`,
        })
    })
})

describe("stripSetupBlock", () => {
    it("removes the setup block and the blank lines around it", () => {
        const value = "Keep\n\n### NIVO setup v1\n- rule\n### end NIVO setup\n\nAfter"

        expect(stripSetupBlock(value)).toBe("KeepAfter")
    })

    it("removes a block that is the whole text", () => {
        expect(stripSetupBlock("### NIVO setup v1\nx\n### end NIVO setup   ")).toBe("")
    })

    it("trims the end of a text that has no setup block", () => {
        expect(stripSetupBlock("Keep only\n")).toBe("Keep only")
    })
})
