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
        })
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
})
