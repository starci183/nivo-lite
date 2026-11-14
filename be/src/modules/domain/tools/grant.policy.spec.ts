import { Test } from "@nestjs/testing"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { isLockedContextRead } from "@modules/domain/context-sources"
import { familyOfTool, grantVerdictOf, grantedByDefault } from "./grant.policy"
import type { ToolCaller, ManifestTool, ToolGrant } from "./tools.contracts"
import type { ModeVerdict } from "./node-mode.policy"
import { toolArgumentsSchema } from "./tool-arguments.schema"

const grant = (tool: string, mode: ToolGrant["mode"]): ToolGrant => ({ tool, mode, limitVnd: null, constraints: [] })

/** The members of the subject under test. */
interface Subject {
    readonly grantVerdictOf: typeof grantVerdictOf
    readonly grantedByDefault: typeof grantedByDefault
}

const SUBJECT = Symbol("grant.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { grantVerdictOf, grantedByDefault } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The verdicts of the node mode a call is judged under. */
const RUN: ModeVerdict = { kind: "run" }
const ASK_MODE: ModeVerdict = { kind: "ask", reason: "ask_mode" }
const OUTSIDE_WRITE: ModeVerdict = { kind: "ask", reason: "outside_write" }
const UNKNOWN: ModeVerdict = { kind: "refuse", reason: "node_mode_unknown" }

/** A NIVO effect tool and a caller in a graph step whose allow-list holds it. */
const EFFECT_SPEC: ManifestTool = {
    name: "message.send",
    description: "",
    scope: "write",
    inputSchema: {},
    defaultMode: "ask",
    argumentSchema: toolArgumentsSchema,
    stepGranted: true,
}
const TOOL_ID = "nivo.tool.customer.message.send"
const STEP_CALLER: ToolCaller = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    conversationId: null,
    workItemId: null,
    run: {
        turnId: "run-1",
        locale: "vi",
        origin: "system",
        memberId: null,
        handedOffBy: null,
        leadId: null,
        stepTools: [TOOL_ID],
    },
}
const NO_STEP: ToolCaller = { ...STEP_CALLER, run: undefined }

/** A read tool of the second brain, and one that would write there. */
const BRAIN_READ: ManifestTool = { ...EFFECT_SPEC, name: "search", scope: "read", defaultMode: "auto", stepGranted: false }
const BRAIN_WRITE: ManifestTool = { ...BRAIN_READ, name: "facts.propose", scope: "write" }

describe("grant.policy grantVerdictOf > a workflow step", () => {
    it("refuses a tool the step's allow-list does not hold, whatever the mode or the row", async () => {
        const subject = await build()

        expect(subject.grantVerdictOf(grant("nivo.tool.lead.*", "auto"), EFFECT_SPEC, STEP_CALLER, "customer.message.ghost", RUN, "step")).toEqual({
            kind: "refuse",
        })
    })

    it("follows the node's mode, never a row's: auto runs, ask asks (ask_mode), an unreadable mode refuses", async () => {
        const subject = await build()

        expect(subject.grantVerdictOf(null, EFFECT_SPEC, STEP_CALLER, TOOL_ID, RUN, "step")).toEqual({ kind: "allow" })
        expect(subject.grantVerdictOf(grant(TOOL_ID, "ask"), EFFECT_SPEC, STEP_CALLER, TOOL_ID, RUN, "step")).toEqual({ kind: "allow" })
        expect(subject.grantVerdictOf(grant(TOOL_ID, "auto"), EFFECT_SPEC, STEP_CALLER, TOOL_ID, ASK_MODE, "step")).toEqual({
            kind: "approval",
            reason: "ask_mode",
        })
        expect(subject.grantVerdictOf(null, EFFECT_SPEC, STEP_CALLER, TOOL_ID, UNKNOWN, "step")).toEqual({ kind: "refuse" })
    })
})

describe("grant.policy grantVerdictOf > a workflow step's default tools", () => {
    it("holds an unlisted record tool and an unlisted read-context tool; the node's mode still applies to the record write", async () => {
        const subject = await build()

        expect(subject.grantVerdictOf(null, EFFECT_SPEC, STEP_CALLER, "nivo.tool.record.create", RUN, "step")).toEqual({ kind: "allow" })
        expect(subject.grantVerdictOf(null, EFFECT_SPEC, STEP_CALLER, "nivo.tool.record.create", ASK_MODE, "step")).toEqual({
            kind: "approval",
            reason: "ask_mode",
        })
        expect(subject.grantVerdictOf(null, BRAIN_READ, STEP_CALLER, "nivo.tool.brain.passage.search", RUN, "step")).toEqual({
            kind: "allow",
        })
        // An unlisted tool that acts outside is still refused.
        expect(subject.grantVerdictOf(null, EFFECT_SPEC, STEP_CALLER, "nivo.tool.mail.message.send", RUN, "step")).toEqual({
            kind: "refuse",
        })
    })
})

describe("grant.policy grantVerdictOf > the engine's own call", () => {
    it("runs with no row", async () => {
        const subject = await build()

        expect(subject.grantVerdictOf(null, EFFECT_SPEC, NO_STEP, TOOL_ID, RUN, "engine")).toEqual({ kind: "allow" })
    })
})

describe("grant.policy grantVerdictOf > a road outside every node", () => {
    it("denies a READ by default (no row, no default read); a WRITE with no row still asks (outside_write): an outside road has no mode", async () => {
        const subject = await build()

        expect(subject.grantVerdictOf(null, BRAIN_READ, NO_STEP, "nivo.tool.ledger.status.get", RUN, "outside")).toEqual({
            kind: "refuse",
        })
        expect(subject.grantVerdictOf(null, EFFECT_SPEC, NO_STEP, TOOL_ID, OUTSIDE_WRITE, "outside")).toEqual({
            kind: "approval",
            reason: "outside_write",
        })
    })

    it("a row is only the allow-list: its mode does not decide, a write asks (outside_write) unless a person approved it", async () => {
        const subject = await build()

        for (const mode of ["auto", "ask"] as const) {
            expect(subject.grantVerdictOf(grant(TOOL_ID, mode), EFFECT_SPEC, NO_STEP, TOOL_ID, OUTSIDE_WRITE, "outside")).toEqual({
                kind: "approval",
                reason: "outside_write",
            })
            expect(subject.grantVerdictOf(grant(TOOL_ID, mode), EFFECT_SPEC, NO_STEP, TOOL_ID, RUN, "outside")).toEqual({ kind: "allow" })
        }
    })

    it("a default read runs with no row", async () => {
        const subject = await build()

        expect(subject.grantVerdictOf(null, BRAIN_READ, NO_STEP, "nivo.tool.brain.search", RUN, "outside")).toEqual({ kind: "allow" })
        expect(subject.grantVerdictOf(null, BRAIN_READ, NO_STEP, TOOL.leadOrderList, RUN, "outside")).toEqual({ kind: "allow" })
    })
})

describe("grant.policy grantedByDefault > the second brain by default", () => {
    it("holds a read tool of the second brain, never a write of it, a read of another connector, or a look-alike", async () => {
        const subject = await build()

        expect(subject.grantedByDefault(BRAIN_READ, "nivo.tool.brain.search")).toBe(true)
        expect(subject.grantedByDefault(BRAIN_WRITE, "nivo.tool.brain.facts.propose")).toBe(false)
        expect(subject.grantedByDefault(BRAIN_READ, "nivo.tool.ledger.status.get")).toBe(false)
        expect(subject.grantedByDefault(BRAIN_READ, "brainy.search")).toBe(false)
    })

    it("holds the passage reads of the second brain like the fact reads", async () => {
        const subject = await build()
        const passage: ManifestTool = { ...BRAIN_READ, name: "passage.search" }

        for (const name of ["nivo.tool.brain.passage.search", "nivo.tool.brain.passage.read"]) {
            expect(subject.grantedByDefault(passage, name)).toBe(true)
        }
    })
})

// FX4 (D-P11-5): a write that only files a request a person decides (`nivo.tool.brain.change.propose`) is a default grant, like the
// second brain's reads: the founder's card is its one decision.
describe("grant.policy grantedByDefault > a tool that only files a request", () => {
    const PROPOSE: ManifestTool = { ...BRAIN_WRITE, name: "change.propose", filesRequest: true }

    it("is held with no row; a write that is no request (no flag) is not", async () => {
        const subject = await build()

        expect(subject.grantedByDefault(PROPOSE, TOOL.brainChangePropose)).toBe(true)
        expect(subject.grantedByDefault(BRAIN_WRITE, TOOL.brainChangePropose)).toBe(false)
    })
})

describe("grant.policy grantedByDefault > the context reads by default", () => {
    const CONTEXT_READ: ManifestTool = { ...BRAIN_READ, name: "lead.order.list" }

    it("holds every registered context read, never a write under the same prefix or an unregistered read", async () => {
        const subject = await build()

        for (const name of [TOOL.conversationMessageList, TOOL.contactGet, TOOL.leadOrderList, TOOL.leadCareGet]) {
            expect(subject.grantedByDefault(CONTEXT_READ, name)).toBe(true)
        }
        expect(subject.grantedByDefault(BRAIN_WRITE, TOOL.leadOrderList)).toBe(false)
        expect(subject.grantedByDefault(CONTEXT_READ, "nivo.tool.lead.secret.list")).toBe(false)
        expect(isLockedContextRead(TOOL.leadOrderList)).toBe(true)
        expect(isLockedContextRead(TOOL.brainSearch)).toBe(false)
    })
})
describe("grant.policy familyOfTool", () => {
    it("names the family after `nivo.tool.`, else the first segment (a source key)", () => {
        expect(familyOfTool("nivo.tool.brain.passage.search")).toBe("brain")
        expect(familyOfTool("crm.customer.find")).toBe("crm")
    })
})
