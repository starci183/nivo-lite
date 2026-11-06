import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WORK_AGENT_DIRECTORY } from "./work-engine.decorators"
import type { WorkAgentDirectory } from "./work-lines.contracts"
import { WorkLinesService } from "./work-lines.service"

const SCOPE = { workspaceId: "ws-1" }
const SALES = { id: "agent-sales", name: "Sales AI" }

const build = async (owner: string | null = "user-owner", agent: typeof SALES | null = SALES) => {
    const chat = mock<TeamChatRoomsService>()
    chat.postMessage.mockResolvedValue({ roomId: "room-1", messageId: "m1" })
    const workspaces = mock<WorkspacesService>()
    workspaces.ownerIdOf.mockResolvedValue(owner)
    const agentOfDepartment = jest.fn().mockResolvedValue(agent)
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkLinesService,
            { provide: TeamChatRoomsService, useValue: chat },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WORK_AGENT_DIRECTORY, useValue: mock<WorkAgentDirectory>({ agentOfDepartment }) },
        ],
    }).compile()
    return { service: moduleRef.get(WorkLinesService), chat, agentOfDepartment }
}

describe("WorkLinesService", () => {
    it("says the line as the agent of the department in the owner's direct room, under the key of the line", async () => {
        const { service, chat, agentOfDepartment } = await build()

        await service.say(SCOPE, { body: "Done", department: "sales", installationId: "inst-1", key: "auto:item-1" })

        expect(agentOfDepartment).toHaveBeenCalledWith("ws-1", "sales", "inst-1")
        expect(chat.postMessage).toHaveBeenCalledWith("ws-1", {
            authorAgentId: "agent-sales",
            roomId: null,
            toUserId: "user-owner",
            body: "Done",
            key: "auto:item-1",
        })
    })

    it("speaks as the agent it is given, and with no key makes none", async () => {
        const { service, chat, agentOfDepartment } = await build()

        await service.say(SCOPE, { body: "Hi", agentId: "agent-9" })

        expect(agentOfDepartment).not.toHaveBeenCalled()
        expect(chat.postMessage.mock.calls[0]?.[1]).toMatchObject({ authorAgentId: "agent-9", key: null })
    })

    it("says nothing when no agent speaks and no room is named, or the workspace has no owner", async () => {
        const noAgent = await build("user-owner", null)
        await noAgent.service.say(SCOPE, { body: "x", department: "sales" })
        await noAgent.service.say(SCOPE, { body: "x" })
        expect(noAgent.chat.postMessage).not.toHaveBeenCalled()
        const noOwner = await build(null)
        await noOwner.service.say(SCOPE, { body: "x", department: "sales" })
        expect(noOwner.chat.postMessage).not.toHaveBeenCalled()
    })

    it("says the line in every room it names: as the agent under its key, else as the system with no key", async () => {
        const spoken = await build()
        await spoken.service.say(SCOPE, { body: "Ask", department: "sales", roomIds: ["r1", "r2"], key: "ask:1" })
        expect(
            spoken.chat.postMessage.mock.calls.map(([, line]) => [line.roomId, line.authorAgentId, line.key]),
        ).toEqual([
            ["r1", "agent-sales", "ask:1"],
            ["r2", "agent-sales", "ask:1"],
        ])
        const system = await build("user-owner", null)
        await system.service.say(SCOPE, { body: "Ask", roomIds: ["r1"], key: "ask:1" })
        expect(system.chat.postMessage.mock.calls[0]?.[1]).toMatchObject({
            authorAgentId: null,
            roomId: "r1",
            toUserId: null,
            key: null,
        })
    })

    it("says a line in a named room with no key as the agent, and makes none", async () => {
        const { service, chat } = await build()

        await service.say(SCOPE, { body: "Hi", agentId: "agent-9", roomIds: ["r1"] })

        expect(chat.postMessage.mock.calls[0]?.[1]).toMatchObject({ authorAgentId: "agent-9", roomId: "r1", key: null })
    })
})
