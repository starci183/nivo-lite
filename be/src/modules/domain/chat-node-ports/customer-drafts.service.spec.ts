import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EngineResult, EntitiesApi, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { CustomerDraftsService } from "./customer-drafts.service"
import { ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"

const NOW = new Date("2026-11-04T10:00:00.000Z")

const TURN: NodeTurn = {
    turnId: "t",
    workspaceId: "ws-1",
    agentId: "a-1",
    subject: null,
    conversationId: "c1",
    locale: "vi",
}

const rowOf = (id: string, data: Readonly<Record<string, unknown>>): RecordRow => ({
    id,
    workspaceId: "ws-1",
    version: "v1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    data,
})

const page = (rows: ReadonlyArray<RecordRow>): ListPage => ({
    rows: rows.map((row) => ({ row, joined: {}, position: [], included: {} })),
    next: null,
})

const written = (id: string): EngineResult => ({ ok: true, row: rowOf(id, {}), version: "v2", created: true })

const build = async () => {
    const api = mock<EntitiesApi>()
    const engine = mock<EntityEngineService>()
    const tx = mock<ScopedTx>()
    engine.scoped.mockImplementation((_workspace, work) => work(tx))
    const ports = mock<EntityPortsService>()
    ports.entitiesApi.mockReturnValue(api)
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerDraftsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
        ],
    }).compile()
    api.list.mockResolvedValue(page([]))
    return { drafts: moduleRef.get(CustomerDraftsService), api }
}

const DRAFT = { conversationId: "c1", text: "Chao chi", key: "run:1" }

describe("CustomerDraftsService", () => {
    it("stores a proposed line of the agent under the call's key, sending nothing", async () => {
        const { drafts, api } = await build()
        api.insert.mockResolvedValue(written("d1"))

        await expect(drafts.propose(TURN, DRAFT)).resolves.toEqual({ id: "d1", status: "proposed", text: "Chao chi" })
        expect(api.insert).toHaveBeenCalledWith(
            "chat.message",
            {
                conversationId: "c1",
                role: "agent",
                authorKind: "ai",
                status: "proposed",
                text: "Chao chi",
                sentAt: NOW.toISOString(),
                channelRef: "draft:run:1",
                sentBy: "a-1",
            },
            { conversation: "c1" },
        )
    })

    it("answers the draft a retry of the same call already stored", async () => {
        const { drafts, api } = await build()
        api.list.mockResolvedValueOnce(page([rowOf("d1", { status: "proposed", text: "Old" })]))

        await expect(drafts.propose(TURN, DRAFT)).resolves.toEqual({ id: "d1", status: "proposed", text: "Old" })
        expect(api.insert).not.toHaveBeenCalled()
    })

    it("takes over the proposed line that waits in the conversation: one draft per conversation", async () => {
        const { drafts, api } = await build()
        api.list
            .mockResolvedValueOnce(page([]))
            .mockResolvedValueOnce(page([rowOf("d0", { status: "proposed", text: "Old" })]))
        api.update.mockResolvedValue(written("d0"))

        await expect(drafts.propose(TURN, DRAFT)).resolves.toMatchObject({ id: "d0", text: "Chao chi" })
        expect(api.update).toHaveBeenCalledWith("chat.message", "d0", "v1", {
            text: "Chao chi",
            sentAt: NOW.toISOString(),
            channelRef: "draft:run:1",
            sentBy: "a-1",
        })
    })

    it("throws when the engine refuses the write", async () => {
        const { drafts, api } = await build()
        api.insert.mockResolvedValue({ ok: false, reason: "stale" })

        await expect(drafts.propose(TURN, DRAFT)).rejects.toMatchObject({ code: ChatNodePortsErrorCode.ProposalRefused })
    })

    it("reads what the owner did with a call's draft, or null when the call wrote none", async () => {
        const { drafts, api } = await build()
        await expect(drafts.draftOf("ws-1", "run:1")).resolves.toBeNull()
        api.list.mockResolvedValueOnce(page([rowOf("d1", { status: "posted", text: "Edited" })]))
        await expect(drafts.draftOf("ws-1", "run:1")).resolves.toEqual({ id: "d1", status: "posted", text: "Edited" })
    })
})
