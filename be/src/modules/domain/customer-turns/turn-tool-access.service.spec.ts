import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentToolsService } from "@modules/domain/agent-tools"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { RUNTIME_TOKEN, RUNTIME_WS, runtimeTurn } from "@tests/fixtures/builders/customer-turn-runtime.builder"
import { CUSTOMER_TURNS_OPTIONS } from "./customer-turns.decorators"
import { TurnSourcesService } from "./turn-sources.service"
import { TurnToolAccessService } from "./turn-tool-access.service"

const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) =>
        params === undefined || Object.keys(params).length === 0 ? key : `${key}${JSON.stringify(params)}`,
})
const PRICE_LIST = [{ layer: 2 as const, kind: "brain_document", ref: "src-1", label: "Price list" }]

const build = async () => {
    const tools = mock<AgentToolsService>({ issue: jest.fn().mockReturnValue(RUNTIME_TOKEN), revoke: jest.fn() })
    const sources = mock<TurnSourcesService>({ keep: jest.fn(), drop: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TurnToolAccessService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CUSTOMER_TURNS_OPTIONS, useValue: { toolsBaseUrl: "https://api.nivo.vn/agent-tools" } },
            { provide: AgentToolsService, useValue: tools },
            { provide: TurnSourcesService, useValue: sources },
        ],
    }).compile()
    return { access: moduleRef.get(TurnToolAccessService), tools, sources }
}

describe("TurnToolAccessService", () => {
    it("mints the turn's token for the inbound message, scoped to its workspace and conversation, for the time limit plus a grace", async () => {
        const { access, tools } = await build()
        expect(access.open(runtimeTurn, 25_000)).toBe(RUNTIME_TOKEN)
        expect(tools.issue).toHaveBeenCalledWith({ jobId: "m1", workspaceId: RUNTIME_WS, conversationId: "c1" }, 55)
        access.open(runtimeTurn, 25_400)
        expect(tools.issue.mock.calls[1]?.[1]).toBe(56)
    })

    it("hands the agent the address and the token in the tool block, and gives no block without a token", async () => {
        const { access } = await build()
        expect(access.blockOf(RUNTIME_TOKEN)).toBe(
            `customerTurns.toolsBlock{"url":"https://api.nivo.vn/agent-tools","token":"${RUNTIME_TOKEN}"}`,
        )
        expect(access.blockOf("")).toBe("")
    })

    it("keeps the turn's knowledge under its message, and closing revokes the token and forgets the knowledge", async () => {
        const { access, tools, sources } = await build()
        access.keep(runtimeTurn, PRICE_LIST)
        expect(sources.keep).toHaveBeenCalledWith("m1", PRICE_LIST)
        access.close(runtimeTurn)
        expect(tools.revoke).toHaveBeenCalledWith("m1")
        expect(sources.drop).toHaveBeenCalledWith("m1")
    })
})
