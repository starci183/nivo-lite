import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentDirectoryService } from "@modules/domain/agents"
import { OfficeRoomDirectoryService } from "@modules/domain/office-rooms"
import { WorkspaceMemberDirectoryService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"

const MEMBER: WorkspaceMember = {
    userId: "van",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "Van",
    status: "active",
}

const MINH = "11111111-1111-4111-8111-111111111111"
const SALES_AI = "22222222-2222-4222-8222-222222222222"

const MINH_ROW = { id: MINH, displayName: "Mr Minh", role: "manager" } as const
const SALES_CARD = { id: SALES_AI, name: "AI Sales", module: "sales", canTagAgentIds: [] }
const SALES_ROOM = { key: "sales", name: "Sales" }

/** What the owners answer in one spec; each is overridable. */
interface Answers {
    readonly people?: ReadonlyArray<typeof MINH_ROW>
    readonly agents?: ReadonlyArray<typeof SALES_CARD>
    readonly rooms?: ReadonlyArray<typeof SALES_ROOM>
}

const build = async (answers: Answers = {}) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(MEMBER) })
    const memberDirectory = mock<WorkspaceMemberDirectoryService>()
    memberDirectory.activeDirectory.mockResolvedValue([...(answers.people ?? [MINH_ROW])])
    memberDirectory.activeAmong.mockResolvedValue([...(answers.people ?? [MINH_ROW])])
    const agents = mock<AgentDirectoryService>()
    agents.activeOf.mockResolvedValue([...(answers.agents ?? [SALES_CARD])])
    agents.activeInOrder.mockResolvedValue([...(answers.agents ?? [SALES_CARD])])
    const rooms = mock<OfficeRoomDirectoryService>()
    rooms.staffedRooms.mockResolvedValue([...(answers.rooms ?? [SALES_ROOM])])
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) =>
            typeof params.name === "string" ? `${key}:${params.name}` : key,
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            MentionDirectoryService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: WorkspaceMemberDirectoryService, useValue: memberDirectory },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: OfficeRoomDirectoryService, useValue: rooms },
        ],
    }).compile()
    return { service: moduleRef.get(MentionDirectoryService), members, memberDirectory, agents, rooms }
}

const registerDirectory = () => {
    describe("directory", () => {
        it("lists people, active agents and groups for a member of the workspace", async () => {
            const { service, members, memberDirectory, agents, rooms } = await build()

            const directory = await service.directory("van", "ws-1", "vi")

            expect(members.require).toHaveBeenCalledWith("van", "ws-1")
            expect(memberDirectory.activeDirectory).toHaveBeenCalledWith("ws-1", 200)
            expect(agents.activeOf).toHaveBeenCalledWith("ws-1", 100)
            expect(rooms.staffedRooms).toHaveBeenCalledWith("ws-1", null, 20)
            expect(directory.members).toEqual([{ kind: "member", id: MINH, name: "Mr Minh", role: "manager" }])
            expect(directory.agents).toEqual([{ kind: "agent", id: SALES_AI, name: "AI Sales", role: "sales" }])
            expect(directory.groups).toEqual([
                { kind: "group", id: "role:owner", name: "thread.group.role.owner", role: "role" },
                { kind: "group", id: "role:manager", name: "thread.group.role.manager", role: "role" },
                { kind: "group", id: "role:staff", name: "thread.group.role.staff", role: "role" },
                { kind: "group", id: "room:sales", name: "thread.group.room:Sales", role: "room" },
            ])
        })
    })
}

const registerResolve = () => {
    describe("resolve", () => {
        it("names a member, an agent, a role group and a room group", async () => {
            const { service, memberDirectory, agents, rooms } = await build()
            const em = mockEntityManager()

            const views = await service.resolve(
                em,
                "ws-1",
                [
                    { kind: "member", id: MINH },
                    { kind: "agent", id: SALES_AI },
                    { kind: "group", id: "role:manager" },
                    { kind: "group", id: "room:sales" },
                ],
                "vi",
            )

            expect(views).toEqual([
                { kind: "member", id: MINH, name: "Mr Minh" },
                { kind: "agent", id: SALES_AI, name: "AI Sales" },
                { kind: "group", id: "role:manager", name: "thread.group.role.manager" },
                { kind: "group", id: "room:sales", name: "thread.group.room:Sales" },
            ])
            expect(memberDirectory.activeAmong).toHaveBeenCalledWith("ws-1", [MINH], 20, em)
            expect(agents.activeInOrder).toHaveBeenCalledWith("ws-1", [SALES_AI], 20)
            expect(rooms.staffedRooms).toHaveBeenCalledWith("ws-1", ["sales"], 20)
        })

        it("refuses a member who is not an active member of the workspace", async () => {
            const { service } = await build({ people: [] })

            await expect(
                service.resolve(mockEntityManager(), "ws-1", [{ kind: "member", id: MINH }], "vi"),
            ).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MentionUnknown,
                params: { kind: "member" },
            })
        })

        it("refuses an agent that is not an active agent of the workspace", async () => {
            const { service } = await build({ agents: [] })

            await expect(
                service.resolve(mockEntityManager(), "ws-1", [{ kind: "agent", id: SALES_AI }], "vi"),
            ).rejects.toMatchObject({ code: ThreadMessagesErrorCode.MentionUnknown })
        })

        it("refuses a room nobody sits in", async () => {
            const { service } = await build({ rooms: [] })

            await expect(
                service.resolve(mockEntityManager(), "ws-1", [{ kind: "group", id: "room:care" }], "vi"),
            ).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MentionUnknown,
                params: { kind: "group" },
            })
        })
    })
}

const registerIdentity = () => {
    describe("identity", () => {
        it("finds the member id of a signed-in account", async () => {
            const { service, memberDirectory } = await build()
            const em = mockEntityManager()
            memberDirectory.idOfUser.mockResolvedValue(MINH)

            await expect(service.memberIdOf(em, "ws-1", "auth-user")).resolves.toBe(MINH)
            expect(memberDirectory.idOfUser).toHaveBeenCalledWith("ws-1", "auth-user", em)
        })

        it("refuses an account that is not a member of the workspace", async () => {
            const { service, memberDirectory } = await build()
            memberDirectory.idOfUser.mockResolvedValue(null)

            await expect(service.memberIdOf(mockEntityManager(), "ws-1", "stranger")).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MemberNotFound,
            })
        })

        it("accepts an active member id and refuses any other", async () => {
            const { service, memberDirectory } = await build()
            const em = mockEntityManager()

            await expect(service.ensureMember(em, "ws-1", MINH)).resolves.toBeUndefined()
            expect(memberDirectory.activeAmong).toHaveBeenCalledWith("ws-1", [MINH], 20, em)

            memberDirectory.activeAmong.mockResolvedValue([])
            await expect(service.ensureMember(em, "ws-1", MINH)).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MemberNotFound,
            })
        })
    })
}

const registerNames = () => {
    describe("names", () => {
        it("names a member of the workspace and answers empty for one that is not", async () => {
            const { service, memberDirectory } = await build()
            const em = mockEntityManager()
            memberDirectory.find.mockResolvedValueOnce(MINH_ROW).mockResolvedValueOnce(null)

            await expect(service.nameOfMember(em, "ws-1", MINH)).resolves.toBe("Mr Minh")
            await expect(service.nameOfMember(em, "ws-1", "nobody")).resolves.toBe("")
            expect(memberDirectory.find).toHaveBeenCalledWith("ws-1", MINH, em)
        })

        it("maps the active members among some ids to their names", async () => {
            const { service, memberDirectory } = await build()
            const em = mockEntityManager()

            await expect(service.namesOf(em, "ws-1", [MINH, "left"])).resolves.toEqual({ [MINH]: "Mr Minh" })
            expect(memberDirectory.activeAmong).toHaveBeenCalledWith("ws-1", [MINH, "left"], 20, em)
        })
    })
}

const registerAgent = () => {
    describe("findAgent", () => {
        it("finds an agent of the workspace by id, or answers null", async () => {
            const { service, agents } = await build()
            agents.find.mockResolvedValueOnce(SALES_CARD).mockResolvedValueOnce(null)

            await expect(service.findAgent("ws-1", SALES_AI)).resolves.toEqual({ id: SALES_AI, name: "AI Sales" })
            await expect(service.findAgent("ws-1", "nobody")).resolves.toBeNull()
            expect(agents.find).toHaveBeenCalledWith("ws-1", SALES_AI)
        })
    })
}

describe("MentionDirectoryService", () => {
    registerDirectory()
    registerResolve()
    registerIdentity()
    registerNames()
    registerAgent()
})
