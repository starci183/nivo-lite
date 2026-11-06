import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentToolsService } from "@modules/domain/agent-tools"
import { runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { TurnSourcesService } from "./turn-sources.service"
import { TurnToolAccessService } from "./turn-tool-access.service"

const PRICE_LIST = [{ layer: 2 as const, kind: "brain_document", ref: "src-1", label: "Price list" }]

const build = async () => {
    const tools = mock<AgentToolsService>({ revoke: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [TurnToolAccessService, TurnSourcesService, { provide: AgentToolsService, useValue: tools }],
    }).compile()
    return { access: moduleRef.get(TurnToolAccessService), sources: moduleRef.get(TurnSourcesService), tools }
}

describe("TurnToolAccessService", () => {
    it("keeps the turn's knowledge under its message for the cards its tool calls open", async () => {
        const { access, sources } = await build()

        access.keep(runtimeTurn, PRICE_LIST)

        expect(sources.of("m1")).toEqual(PRICE_LIST)
    })

    it("forgets the knowledge when the turn ends, and revokes the token of the turn", async () => {
        const { access, sources, tools } = await build()
        access.keep(runtimeTurn, PRICE_LIST)

        access.close(runtimeTurn)

        expect(sources.of("m1")).toEqual([])
        expect(tools.revoke).toHaveBeenCalledWith("m1")
    })
})
