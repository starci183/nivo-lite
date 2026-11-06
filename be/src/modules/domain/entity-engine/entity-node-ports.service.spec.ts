import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { ListPage, PageRow, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import { EntityEngineService } from "./entity-engine.service"
import { EntityNodePortsService } from "./entity-node-ports.service"
import { mintScopedTx } from "./policies/scoped-tx.policy"
import type { EntityNodeTurn } from "./entity-node.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const TX = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS })
const AT = "2026-11-06T10:00:00.000Z"
const CURSOR_SCOPE = cursorScopeOf("node.message", { scope: "workspace", anchor: "" }, "newest")
const TURN: EntityNodeTurn = { workspaceId: WS, subject: null, conversationId: null }

const MESSAGE: EntityDefinition = {
    entry: "entity",
    name: "chat.message",
    dataKind: "message",
    fields: { body: { kind: "text", nullable: false, maxLength: 4000 } },
    relations: { conversation: { kind: "toOne", target: "chat.conversation" } },
}

const CONVERSATION: EntityDefinition = {
    entry: "entity",
    name: "chat.conversation",
    dataKind: "conversation",
    fields: { title: { kind: "text", nullable: true, maxLength: 100 } },
}

const rowOf = (id: string, conversation: string | null): PageRow => {
    const row: RecordRow = {
        id,
        workspaceId: WS,
        version: "1",
        createdAt: AT,
        updatedAt: AT,
        data: { body: `body ${id}` },
    }
    return {
        row,
        joined: { conversation: conversation === null ? null : { id: conversation, data: {} } },
        position: [id],
        included: {},
    }
}

const pageOf = (rows: ReadonlyArray<PageRow>, next: string | null): ListPage => ({ rows, next })

const build = async () => {
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspace, work) => work(TX))
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityNodePortsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: ENTITY_ENGINE_OPTIONS, useValue: { entities: [CONVERSATION, MESSAGE], jobs: [] } },
        ],
    }).compile()
    const ports = moduleRef.get(EntityNodePortsService).ports()
    return { reader: ports[1], engine }
}

describe("EntityNodePortsService", () => {
    it("answers one port per declared entity under its data kind", async () => {
        const { reader } = await build()
        expect(reader?.kind).toBe("message")
    })

    it("reads a workspace query in one scoped page and cuts each record to the fields asked", async () => {
        const { reader, engine } = await build()
        engine.list.mockResolvedValue(pageOf([rowOf("m-1", null), rowOf("m-2", null)], "more"))

        const rows = await reader?.read(TURN, { fields: ["id", "body"], limit: 2 }, "workspace")

        expect(rows).toEqual([
            { id: "m-1", body: "body m-1" },
            { id: "m-2", body: "body m-2" },
        ])
        expect(engine.scoped).toHaveBeenCalledWith(WS, expect.any(Function))
        expect(engine.list).toHaveBeenCalledTimes(1)
        expect(engine.list).toHaveBeenCalledWith(
            TX,
            expect.objectContaining({ from: "chat.message", select: ["body"], page: { size: 2 } }),
            CURSOR_SCOPE,
        )
    })

    it("answers nothing, without a statement, for a turn read that reaches no record of the turn", async () => {
        const { reader, engine } = await build()
        expect(await reader?.read(TURN, { fields: ["id"] }, "turn")).toEqual([])
        expect(engine.scoped).not.toHaveBeenCalled()
    })

    it("keeps the records linked to the turn's conversation, scanning the next page while it holds fewer than the limit", async () => {
        const { reader, engine } = await build()
        engine.list
            .mockResolvedValueOnce(pageOf([rowOf("m-1", "c-other"), rowOf("m-2", "c-1")], "page-2"))
            .mockResolvedValueOnce(pageOf([rowOf("m-3", null), rowOf("m-4", "c-1")], null))

        const rows = await reader?.read({ ...TURN, conversationId: "c-1" }, { fields: ["id"], limit: 5 }, "turn")

        expect(rows).toEqual([{ id: "m-2" }, { id: "m-4" }])
        expect(engine.list).toHaveBeenCalledTimes(2)
        expect(engine.list.mock.calls[0]?.[1].page.after).toBeUndefined()
        expect(engine.list.mock.calls[1]?.[1].page.after).toBe("page-2")
        expect(engine.list.mock.calls[1]?.[2]).toBe(engine.list.mock.calls[0]?.[2])
    })

    it("stops scanning once the limit is met, and after the page budget", async () => {
        const { reader, engine } = await build()
        engine.list.mockResolvedValue(pageOf([rowOf("m-1", "c-1"), rowOf("m-2", "c-1")], "again"))

        expect(await reader?.read({ ...TURN, conversationId: "c-1" }, { fields: ["id"], limit: 1 }, "turn")).toEqual([
            { id: "m-1" },
        ])
        expect(engine.list).toHaveBeenCalledTimes(1)

        engine.list.mockClear()
        engine.list.mockResolvedValue(pageOf([rowOf("m-9", "c-other")], "again"))
        expect(await reader?.read({ ...TURN, conversationId: "c-1" }, { fields: ["id"], limit: 5 }, "turn")).toEqual([])
        expect(engine.list).toHaveBeenCalledTimes(10)
    })
})
