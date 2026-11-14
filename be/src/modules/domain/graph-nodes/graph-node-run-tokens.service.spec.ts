import { FakeClock, fakeIds } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { IDS } from "@modules/platform/ids"
import { GraphNodeRunTokensService } from "./graph-node-run-tokens.service"
import type { NodeTurn } from "./graph-nodes.contracts"

const NOW = Date.parse("2026-11-04T10:00:00.000Z")

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conv-1",
    locale: "vi",
}

const build = async (prefix = "00000000") => {
    const clock = new FakeClock(NOW)
    const moduleRef = await Test.createTestingModule({
        providers: [
            GraphNodeRunTokensService,
            { provide: CLOCK, useValue: clock },
            { provide: IDS, useValue: fakeIds(prefix) },
        ],
    }).compile()
    return { tokens: moduleRef.get(GraphNodeRunTokensService), clock }
}

describe("GraphNodeRunTokensService", () => {
    it("mints a token that names the run as the host knows it, a system run reading the workspace", async () => {
        const { tokens } = await build()

        expect(tokens.verify(tokens.mint(TURN))).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            runId: "run-1",
            conversationId: "conv-1",
            origin: "system",
            memberId: null,
            scope: "workspace",
            expiresAt: NOW + 300_000,
            contactId: null,
            leadId: null,
        })
    })

    it("signs the customer the run is about when the turn's subject is one, and no step allow-list (no gateway effect runs)", async () => {
        const { tokens } = await build()
        const claims = tokens.verify(tokens.mint({ ...TURN, subject: { kind: "sales-lead", id: "lead-1" } }))

        expect(claims).toMatchObject({ leadId: "lead-1" })
        expect(claims).not.toHaveProperty("stepTools")
        expect(tokens.verify(tokens.mint({ ...TURN, contactId: "contact-1" }))).toMatchObject({ contactId: "contact-1", leadId: null })
        expect(claims).not.toHaveProperty("locale")
        expect(tokens.verify(tokens.mint({ ...TURN, subject: { kind: "order", id: "o-1" } }))).toMatchObject({ leadId: null })
    })

    it("keeps a customer's run to public knowledge and names the member behind a person's turn", async () => {
        const { tokens } = await build()

        expect(tokens.verify(tokens.mint({ ...TURN, origin: "customer" }))).toMatchObject({ scope: "public" })
        expect(tokens.verify(tokens.mint({ ...TURN, origin: "staff", memberId: "member-1" }))).toMatchObject({
            origin: "staff",
            memberId: "member-1",
            scope: "workspace",
        })
    })

    it("refuses its token once expired, and a token another process minted", async () => {
        const { tokens, clock } = await build()
        const other = await build("0000000f")
        const token = tokens.mint(TURN)

        expect(other.tokens.verify(token)).toBeNull()
        clock.advance(300_000)
        expect(tokens.verify(token)).toBeNull()
    })

    it("signs the part the run plays for the provider trigger that started it; a token without it is no notice run", async () => {
        const { tokens } = await build()
        const step = { nodeKey: "ledger", versionId: "v-6", workflowId: "wf-1" }

        expect(tokens.verify(tokens.mint(TURN, { ...step, triggerRole: "notice" }))?.step).toEqual({ ...step, triggerRole: "notice" })
        expect(tokens.verify(tokens.mint(TURN, { ...step, triggerRole: "decider" }))?.step?.triggerRole).toBe("decider")
        expect(tokens.verify(tokens.mint(TURN, step))?.step).not.toHaveProperty("triggerRole")
    })

    it("signs the workflow step the host names, and none when it names none", async () => {
        const { tokens } = await build()
        const step = { nodeKey: "send-qr", versionId: "v-3", workflowId: "wf-1" }

        expect(tokens.verify(tokens.mint(TURN, step))).toMatchObject({ runId: "run-1", step })
        expect(tokens.verify(tokens.mint(TURN, { ...step, workflowId: null }))?.step).toEqual({ ...step, workflowId: null })
        expect(tokens.verify(tokens.mint(TURN))).not.toHaveProperty("step")
    })
})
