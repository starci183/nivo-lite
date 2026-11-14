import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionsError } from "@modules/domain/connections"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { CHANNEL_PROVISIONING_OPTIONS } from "./channel-provisioning.decorators"
import { CHAT_SEED_SCHEMA } from "./chat-seed.contracts"
import { ChatSeedService, INSERT_LINE, INSERT_ROOM, INSERT_SEAT } from "./chat-seed.service"

const WORKSPACE_ID = "6f1c2a52-0000-4000-8000-000000000001"
const OWNER_ID = "6f1c2a52-0000-4000-8000-0000000000a1"
const SALES_ID = "6f1c2a52-0000-4000-8000-0000000000b1"
const CARD = { kind: "order.summary", intent: "notify" }
const ROOM = {
    id: "5eed0c4a-0000-4000-8000-000000000001",
    name: "Room",
    purpose: "module",
    module: "sales",
    members: [{ role: "owner" }, { role: "staff" }, { agent: "sales", mayPost: true }],
    messages: [
        { key: "m-1", from: { role: "owner" }, day: "yesterday", time: "08:30", body: "one" },
        { key: "m-2", from: { role: "staff" }, day: "today", time: "08:40", body: "two" },
        { key: "m-3", from: { agent: "sales" }, day: "today", time: "09:00", body: "three", agentMessage: CARD },
    ],
}
const TEXT = JSON.stringify({ documents: [{ path: "d.json", document: { schema: CHAT_SEED_SCHEMA, rooms: [ROOM] } }] })

const build = async () => {
    const em = mockEntityManager({
        query: [
            [INSERT_ROOM, []],
            [INSERT_SEAT, []],
            [INSERT_LINE, []],
        ],
    })
    const transaction = fakeTransaction(em)
    const agents = mock<AgentDirectoryService>()
    agents.firstActiveIdOfModule.mockResolvedValue(SALES_ID)
    const members = mock<WorkspaceMembersReadService>()
    members.directory.mockResolvedValue([
        { id: "s1", user_id: OWNER_ID, display_name: "Owner", role: "owner", status: "active" },
    ])
    const workspaces = mock<WorkspacesService>()
    workspaces.list.mockResolvedValue([{ id: WORKSPACE_ID, name: "NIVO" }])
    const print = jest.fn<void, [string]>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatSeedService,
            { provide: CHANNEL_PROVISIONING_OPTIONS, useValue: { print } },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-11-09T05:00:00Z") },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: WorkspaceMembersReadService, useValue: members },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
        ],
    }).compile()
    return { service: moduleRef.get(ChatSeedService), transaction, print }
}

const textsOf = (calls: ReadonlyArray<{ readonly args: ReadonlyArray<unknown> }>): ReadonlyArray<unknown> =>
    calls.map((call) => call.args[0])

describe("ChatSeedService", () => {
    it("writes the room, the seats it can find and the lines of those seats, with the card kept in ref", async () => {
        const { service, transaction, print } = await build()

        await service.run(TEXT, "NIVO")

        const texts = textsOf(transaction.committedWrites)
        expect(texts.filter((text) => text === INSERT_ROOM)).toHaveLength(1)
        expect(texts.filter((text) => text === INSERT_SEAT)).toHaveLength(2)
        expect(texts.filter((text) => text === INSERT_LINE)).toHaveLength(2)
        const cardValues = transaction.committedWrites.filter((write) => write.args[0] === INSERT_LINE)[1]?.args[1]
        expect(cardValues).toContain(JSON.stringify({ agent_message: JSON.stringify(CARD) }))
        const roomValues = transaction.committedWrites.find((write) => write.args[0] === INSERT_ROOM)?.args[1]
        expect(roomValues).toEqual([ROOM.id, WORKSPACE_ID, ROOM.name, "module", "sales", OWNER_ID])
        const seatValues = transaction.committedWrites
            .filter((write) => write.args[0] === INSERT_SEAT)
            .map((write) => write.args[1])
        expect(seatValues).toEqual([
            [ROOM.id, WORKSPACE_ID, "user", OWNER_ID, "owner", false],
            [ROOM.id, WORKSPACE_ID, "agent", SALES_ID, "member", true],
        ])
        expect(INSERT_SEAT).toContain("DO UPDATE SET may_post = EXCLUDED.may_post")
        expect(print).toHaveBeenCalledWith(`chat ${ROOM.id} saved`)
    })

    it("gives a line the same id in every run, and every statement keeps what is there", async () => {
        const first = await build()
        const second = await build()

        await first.service.run(TEXT, "NIVO")
        await second.service.run(TEXT, "NIVO")

        const idsOf = (writes: ReadonlyArray<{ readonly args: ReadonlyArray<unknown> }>) =>
            writes.filter((write) => write.args[0] === INSERT_LINE).map((write) => write.args[1])
        expect(idsOf(first.transaction.committedWrites)).toEqual(idsOf(second.transaction.committedWrites))
        expect([INSERT_ROOM, INSERT_SEAT, INSERT_LINE].every((text) => text.includes("ON CONFLICT"))).toBe(true)
    })

    it("refuses a workspace that is not there", async () => {
        const { service } = await build()
        await expect(service.run(TEXT, "OTHER")).rejects.toBeInstanceOf(ConnectionsError)
    })
})
