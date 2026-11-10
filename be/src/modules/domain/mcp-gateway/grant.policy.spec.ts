import { Test } from "@nestjs/testing"
import { TOOL } from "@nivo-lite/blocks-core"
import { grantOfCall, isLockedContextRead, judgeGrant } from "./grant.policy"
import type { GatewayCaller, GatewayToolSpec, ToolGrant } from "./mcp-gateway.contracts"

const grant = (tool: string, mode: ToolGrant["mode"], limits: Partial<ToolGrant> = {}): ToolGrant => ({
    tool,
    mode,
    limitVnd: null,
    constraints: [],
    ...limits,
})

/** The members of the subject under test. */
interface Subject {
    readonly judgeGrant: typeof judgeGrant
    readonly grantOfCall: typeof grantOfCall
}

const SUBJECT = Symbol("grant.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { judgeGrant, grantOfCall } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("grant.policy", () => {
    it("denies by default and for never", async () => {
        const subject = await build()
        expect(subject.judgeGrant(null, {}, false)).toEqual({ kind: "refuse" })
        expect(subject.judgeGrant(grant("a.b", "never"), {}, true)).toEqual({ kind: "refuse" })
        expect(subject.judgeGrant(null, {}, false, true)).toEqual({ kind: "approval", reason: "no_rule" })
        expect(subject.judgeGrant(null, {}, true, true)).toEqual({ kind: "allow" })
    })

    it("asks in ask mode unless the call replays an approval", async () => {
        const subject = await build()
        expect(subject.judgeGrant(grant("a.b", "ask"), {}, false)).toEqual({ kind: "approval", reason: "ask_mode" })
        expect(subject.judgeGrant(grant("a.b", "ask"), {}, true)).toEqual({ kind: "allow" })
    })

    it("asks over a data constraint or the amount limit, allows within them and leaves other arguments alone", async () => {
        const subject = await build()
        const limited = grant("a.b", "auto", { constraints: [{ arg: "quantity", max: 10 }], limitVnd: 1000 })

        expect(subject.judgeGrant(limited, { quantity: 15 }, false)).toEqual({
            kind: "approval",
            reason: "over_constraint",
        })
        expect(subject.judgeGrant(limited, { quantity: 15 }, true)).toEqual({ kind: "allow" })
        expect(subject.judgeGrant(limited, { amountVnd: 2000 }, false)).toEqual({
            kind: "approval",
            reason: "over_limit_vnd",
        })
        expect(subject.judgeGrant(limited, { quantity: 10, amountVnd: 999 }, false)).toEqual({ kind: "allow" })
        expect(subject.judgeGrant(limited, { quantity: "50" }, false)).toEqual({ kind: "allow" })
        expect(subject.judgeGrant(grant("a.b", "auto"), { amountVnd: 9e9, rate: 99 }, false)).toEqual({ kind: "allow" })
    })
})

/** A NIVO effect tool and a caller in a graph step whose allow-list holds it. */
const EFFECT_SPEC: GatewayToolSpec = {
    name: "message.send",
    description: "",
    scope: "write",
    inputSchema: {},
    defaultMode: "ask",
    stepGranted: true,
}
const STEP_CALLER: GatewayCaller = {
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
        stepTools: ["nivo.lead.message.send"],
    },
}

describe("grant.policy grantOfCall", () => {
    it("grants a step-granted tool the step declared, to run alone, when the owner set no row", async () => {
        const subject = await build()

        expect(subject.grantOfCall(null, EFFECT_SPEC, STEP_CALLER, "nivo.lead.message.send")).toEqual(
            grant("nivo.lead.message.send", "auto"),
        )
    })

    it("keeps the owner's row when one applies", async () => {
        const subject = await build()
        const row = grant("nivo.lead.*", "ask")

        expect(subject.grantOfCall(row, EFFECT_SPEC, STEP_CALLER, "nivo.lead.message.send")).toBe(row)
    })

    it("grants nothing outside the step, for a tool not step-granted, or a caller in no step", async () => {
        const subject = await build()
        const outside: GatewayCaller = { ...STEP_CALLER, run: undefined }

        expect(subject.grantOfCall(null, EFFECT_SPEC, STEP_CALLER, "customer.message.ghost")).toBeNull()
        expect(subject.grantOfCall(null, { ...EFFECT_SPEC, stepGranted: false }, STEP_CALLER, "nivo.lead.message.send")).toBeNull()
        expect(subject.grantOfCall(null, EFFECT_SPEC, outside, "nivo.lead.message.send")).toBeNull()
    })
})

/** A read tool of the second brain, and one that would write there. */
const BRAIN_READ: GatewayToolSpec = { ...EFFECT_SPEC, name: "search", scope: "read", defaultMode: "auto", stepGranted: false }
const BRAIN_WRITE: GatewayToolSpec = { ...BRAIN_READ, name: "facts.propose", scope: "write" }
const NO_STEP: GatewayCaller = { ...STEP_CALLER, run: undefined }

describe("grant.policy grantOfCall > the second brain by default", () => {
    it("grants a read tool of the second brain to an agent with no row, in a step that declares it and outside any step", async () => {
        const subject = await build()
        const run = STEP_CALLER.run
        const step: GatewayCaller =
            run === undefined ? STEP_CALLER : { ...STEP_CALLER, run: { ...run, stepTools: ["nivo.brain.search"] } }

        expect(step.run?.stepTools).toEqual(["nivo.brain.search"])
        expect(subject.grantOfCall(null, BRAIN_READ, step, "nivo.brain.search")).toEqual(grant("nivo.brain.search", "auto"))
        expect(subject.grantOfCall(null, BRAIN_READ, NO_STEP, "nivo.brain.search")).toEqual(grant("nivo.brain.search", "auto"))
        expect(subject.judgeGrant(subject.grantOfCall(null, BRAIN_READ, step, "nivo.brain.search"), {}, false)).toEqual({
            kind: "allow",
        })
    })

    it("lets the owner's row win, so `never` still refuses the second brain", async () => {
        const subject = await build()
        const never = grant("nivo.brain.*", "never")

        expect(subject.grantOfCall(never, BRAIN_READ, NO_STEP, "nivo.brain.search")).toBe(never)
        expect(subject.judgeGrant(never, {}, false)).toEqual({ kind: "refuse" })
    })

    it("never grants a write of the second brain, a read of another connector, or a read the step did not declare", async () => {
        const subject = await build()

        expect(subject.grantOfCall(null, BRAIN_WRITE, NO_STEP, "brain.facts.propose")).toBeNull()
        expect(subject.grantOfCall(null, BRAIN_READ, NO_STEP, "nivo.ledger.status.get")).toBeNull()
        expect(subject.grantOfCall(null, BRAIN_READ, NO_STEP, "brainy.search")).toBeNull()
        expect(subject.grantOfCall(null, BRAIN_READ, STEP_CALLER, "nivo.brain.search")).toBeNull()
    })
})

describe("grant.policy grantOfCall > the context reads by default", () => {
    const CONTEXT_READ: GatewayToolSpec = { ...BRAIN_READ, name: "lead.order.list" }

    it("grants every registered context read to an agent with no row, and never a write under the same prefix", async () => {
        const subject = await build()

        for (const name of [TOOL.conversationMessageList, TOOL.leadProfileGet, TOOL.leadOrderList, TOOL.leadNoteList]) {
            expect(subject.grantOfCall(null, CONTEXT_READ, NO_STEP, name)).toEqual(grant(name, "auto"))
        }
        expect(subject.grantOfCall(null, BRAIN_WRITE, NO_STEP, TOOL.leadOrderList)).toBeNull()
        expect(subject.grantOfCall(null, CONTEXT_READ, NO_STEP, "nivo.lead.secret.list")).toBeNull()
        expect(isLockedContextRead(TOOL.leadOrderList)).toBe(true)
        expect(isLockedContextRead(TOOL.brainSearch)).toBe(false)
    })

    it("lets an owner's row forbid one", async () => {
        const subject = await build()
        const never = grant(TOOL.leadOrderList, "never")

        expect(subject.judgeGrant(subject.grantOfCall(never, CONTEXT_READ, NO_STEP, TOOL.leadOrderList), {}, false)).toEqual({
            kind: "refuse",
        })
    })
})
