import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentWakeService, AgentWorkSettingsService } from "@modules/domain/agent-work"
import type { AgentWorkSettingsRecord, AgentWorkState } from "@modules/domain/agent-work"
import { AgentDirectoryService, AgentOwnershipService } from "@modules/domain/agents"
import type { AgentHandleCard } from "@modules/domain/agents"
import { OfficeLinesService, TeamChatService } from "@modules/domain/messages"
import type { PostedMessage } from "@modules/domain/messages"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { OfficeTagService } from "./office-tag.service"

const KE_TOAN: AgentHandleCard = { id: "agent-kt", handle: "ke-toan", module: "accounting", name: "Ke toan" }
const SALES: AgentHandleCard = { id: "agent-sa", handle: "sales", module: "sales", name: "Sales" }
const CARE: AgentHandleCard = { id: "agent-ca", handle: "care", module: "care", name: "Care" }
const EXTRA: AgentHandleCard = { id: "agent-ex", handle: "extra", module: "extra", name: "Extra" }

const POSTED: PostedMessage = {
    id: "msg-1",
    author_kind: "human",
    author_name: "Lan",
    author_user_id: "user-1",
    agent_id: null,
    staff_id: null,
    body: "x",
    lead_id: null,
    work_item_id: null,
    room: null,
    created_at: "2026-10-31T10:00:00.000Z",
}

const settingsOf = (workEnabled = true): AgentWorkSettingsRecord => ({
    workspaceId: "ws-1",
    workEnabled,
    road: "legacy",
    backgroundDailyCap: 20,
})

const stateOf = (workEnabled = true): AgentWorkState => ({
    agentId: "a",
    workEnabled,
    failures: 0,
    breakerUntil: null,
    lastTurnAt: null,
    backgroundDay: null,
    backgroundTurns: 0,
})

interface Setup {
    readonly found?: ReadonlyArray<AgentHandleCard>
    readonly may?: Readonly<Record<string, boolean>>
    readonly workspaceOn?: boolean
    readonly agentOn?: boolean
}

const build = async (setup: Setup = {}) => {
    const em = mockEntityManager({})
    const transaction = fakeTransaction(em)
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Record<string, unknown>) => `${key}:${String(params.handle)}`),
    })
    const chat = mock<TeamChatService>({ postHuman: jest.fn().mockResolvedValue(POSTED) })
    const lines = mock<OfficeLinesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const members = mock<WorkspaceMembersService>({ idOf: jest.fn().mockResolvedValue("member-1") })
    const agents = mock<AgentDirectoryService>({ activeByHandles: jest.fn().mockResolvedValue(setup.found ?? []) })
    const ownership = mock<AgentOwnershipService>({
        canAssign: jest.fn((_member: string, agentId: string) => Promise.resolve(setup.may?.[agentId] ?? true)),
    })
    const wakes = mock<AgentWakeService>({ wake: jest.fn().mockResolvedValue(true) })
    const settings = mock<AgentWorkSettingsService>({
        settingsOf: jest.fn().mockResolvedValue(settingsOf(setup.workspaceOn ?? true)),
        stateOf: jest.fn().mockResolvedValue(stateOf(setup.agentOn ?? true)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeTagService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: TeamChatService, useValue: chat },
            { provide: OfficeLinesService, useValue: lines },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: AgentOwnershipService, useValue: ownership },
            { provide: AgentWakeService, useValue: wakes },
            { provide: AgentWorkSettingsService, useValue: settings },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeTagService), transaction, chat, lines, members, agents, ownership, wakes, settings }
}

const request = (body: string, room: string | null = null) => ({ body, room, locale: "vi" as const })

describe("OfficeTagService > a line that tags", () => {
    it("wakes the one agent a member tags, in the post's transaction, keyed by the message", async () => {
        const { service, chat, wakes, transaction, members, agents } = await build({ found: [KE_TOAN] })

        await expect(service.post("user-1", "ws-1", request("@ke-toan how much is due?"))).resolves.toBe(POSTED)

        expect(members.idOf).toHaveBeenCalledWith("user-1", "ws-1")
        expect(agents.activeByHandles).toHaveBeenCalledWith("ws-1", ["ke-toan"], 10)
        expect(transaction.commits).toBe(1)
        expect(chat.postHuman).toHaveBeenCalledWith("user-1", "ws-1", "@ke-toan how much is due?", null, expect.anything())
        expect(wakes.wake.mock.calls).toEqual([
            [
                expect.anything(),
                {
                    workspaceId: "ws-1",
                    agentId: "agent-kt",
                    source: "tag",
                    eventKey: "msg-1",
                    context: { messageId: "msg-1", authorUserId: "user-1", locale: "vi" },
                    actorMemberId: "member-1",
                },
            ],
        ])
    })

    it("carries the room of the line in the wake", async () => {
        const { service, wakes } = await build({ found: [KE_TOAN] })

        await service.post("user-1", "ws-1", request("@ke-toan hi", "accounting"))

        expect(wakes.wake.mock.calls[0]?.[1].context).toEqual({
            messageId: "msg-1",
            authorUserId: "user-1",
            locale: "vi",
            room: "accounting",
        })
    })

    it("wakes up to three distinct agents, in the order written, and no fourth", async () => {
        const found = [KE_TOAN, SALES, CARE, EXTRA]
        const { service, wakes } = await build({ found })

        await service.post("user-1", "ws-1", request("@sales @ke-toan @care @extra @sales go"))

        expect(wakes.wake.mock.calls.map(([, wake]) => wake.agentId)).toEqual(["agent-sa", "agent-kt", "agent-ca"])
    })

    it("wakes nobody and looks nobody up for a line that tags no one", async () => {
        const { service, chat, wakes, agents, settings } = await build()

        await expect(service.post("user-1", "ws-1", request("good morning"))).resolves.toBe(POSTED)

        expect(chat.postHuman).toHaveBeenCalledTimes(1)
        expect(agents.activeByHandles).not.toHaveBeenCalled()
        expect(settings.settingsOf).not.toHaveBeenCalled()
        expect(wakes.wake).not.toHaveBeenCalled()
    })

    it("wakes nobody for a handle no active agent holds", async () => {
        const { service, wakes, ownership } = await build({ found: [] })

        await service.post("user-1", "ws-1", request("@ghost are you there?"))

        expect(ownership.canAssign).not.toHaveBeenCalled()
        expect(wakes.wake).not.toHaveBeenCalled()
    })
})

describe("OfficeTagService > rights and switches", () => {
    it("writes one NIVO line and no wake for an agent the member may not ask", async () => {
        const { service, lines, wakes, ownership, transaction } = await build({
            found: [KE_TOAN, SALES],
            may: { "agent-kt": false },
        })

        await service.post("user-1", "ws-1", request("@ke-toan @sales help", "accounting"))

        expect(ownership.canAssign.mock.calls).toEqual([
            ["member-1", "agent-kt"],
            ["member-1", "agent-sa"],
        ])
        expect(lines.post.mock.calls).toEqual([
            [
                { workspaceId: "ws-1" },
                { body: "office.tagRefused:ke-toan", lead_id: null, work_item_id: null, room: "accounting" },
                expect.anything(),
            ],
        ])
        expect(wakes.wake.mock.calls.map(([, wake]) => wake.agentId)).toEqual(["agent-sa"])
        expect(transaction.commits).toBe(1)
    })

    it("still wakes an agent whose work is switched off, and says so, so the wake is held and not lost", async () => {
        const { service, lines, wakes } = await build({ found: [KE_TOAN], agentOn: false })

        await service.post("user-1", "ws-1", request("@ke-toan hi"))

        expect(lines.post.mock.calls.map(([, line]) => line.body)).toEqual(["office.tagWorkOff:ke-toan"])
        expect(wakes.wake).toHaveBeenCalledTimes(1)
    })

    it("says the same when the whole workspace is switched off", async () => {
        const { service, lines, wakes, settings } = await build({ found: [KE_TOAN], workspaceOn: false })

        await service.post("user-1", "ws-1", request("@ke-toan hi"))

        expect(settings.stateOf).toHaveBeenCalledWith("agent-kt")
        expect(lines.post.mock.calls.map(([, line]) => line.body)).toEqual(["office.tagWorkOff:ke-toan"])
        expect(wakes.wake).toHaveBeenCalledTimes(1)
    })

    it("rolls the line back with its wakes when a wake cannot be written", async () => {
        const { service, wakes, transaction } = await build({ found: [KE_TOAN] })
        const failure = new Error("queue down")
        wakes.wake.mockRejectedValue(failure)

        await expect(service.post("user-1", "ws-1", request("@ke-toan hi"))).rejects.toBe(failure)

        expect(transaction.rollbacks).toBe(1)
        expect(transaction.commits).toBe(0)
    })

    it("writes nothing when the caller is no member", async () => {
        const { service, members, chat, wakes } = await build({ found: [KE_TOAN] })
        const refusal = new Error("not a member")
        members.idOf.mockRejectedValue(refusal)

        await expect(service.post("user-1", "ws-1", request("@ke-toan hi"))).rejects.toBe(refusal)

        expect(chat.postHuman).not.toHaveBeenCalled()
        expect(wakes.wake).not.toHaveBeenCalled()
    })
})
