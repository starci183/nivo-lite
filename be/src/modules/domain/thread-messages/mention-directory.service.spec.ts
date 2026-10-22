import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MentionDirectoryService } from "./mention-directory.service"
import {
    FIND_AGENT_REFS,
    FIND_MEMBER_ID,
    FIND_MEMBER_NAME,
    FIND_MEMBER_REFS,
    FIND_ROOM_GROUPS,
    LIST_DIRECTORY_AGENTS,
    LIST_DIRECTORY_MEMBERS,
    LIST_DIRECTORY_ROOMS,
} from "./persistence/thread-messages.sql"

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

interface Answers {
    readonly people?: ReadonlyArray<unknown>
    readonly agents?: ReadonlyArray<unknown>
    readonly rooms?: ReadonlyArray<unknown>
    readonly name?: ReadonlyArray<unknown>
    readonly memberId?: ReadonlyArray<unknown>
}

/** What the database double answers: rows per statement. */
type DatabaseStubs = {
    readonly query: ReadonlyArray<readonly [string, unknown]>
}

/** The rows the database double answers for each statement, overridable per spec. */
const stubsOf = (answers: Answers = {}): DatabaseStubs => ({
    query: [
        [
            FIND_MEMBER_REFS,
            answers.people ?? [{ id: MINH, display_name: "Mr Minh", role: "manager", room_key: "sales" }],
        ],
        [FIND_AGENT_REFS, answers.agents ?? [{ id: SALES_AI, name: "AI Sales" }]],
        [FIND_ROOM_GROUPS, answers.rooms ?? [{ key: "sales", name: "Sales" }]],
        [LIST_DIRECTORY_MEMBERS, [{ id: MINH, display_name: "Mr Minh", role: "manager", room_key: "sales" }]],
        [LIST_DIRECTORY_AGENTS, [{ id: SALES_AI, name: "AI Sales", module: "sales" }]],
        [LIST_DIRECTORY_ROOMS, [{ key: "sales", name: "Sales" }]],
        [FIND_MEMBER_NAME, answers.name ?? [{ display_name: "Mr Minh" }]],
        [FIND_MEMBER_ID, answers.memberId ?? [{ id: MINH }]],
    ],
})

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue(MEMBER) })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) =>
            typeof params.name === "string" ? `${key}:${params.name}` : key,
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            MentionDirectoryService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(MentionDirectoryService), members }
}

const registerDirectory = () => {
    describe("directory", () => {
        it("lists people, active agents and groups for a member of the workspace", async () => {
            const { service, members } = await build(mockEntityManager(stubsOf()))

            const directory = await service.directory("van", "ws-1", "vi")

            expect(members.require).toHaveBeenCalledWith("van", "ws-1")
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
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

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
            expect(em.query).toHaveBeenCalledWith(FIND_MEMBER_REFS, ["ws-1", [MINH]])
            expect(em.query).toHaveBeenCalledWith(FIND_AGENT_REFS, ["ws-1", [SALES_AI]])
            expect(em.query).toHaveBeenCalledWith(FIND_ROOM_GROUPS, ["ws-1", ["sales"]])
        })

        it("refuses a member who is not an active member of the workspace", async () => {
            const em = mockEntityManager(stubsOf({ people: [] }))
            const { service } = await build(em)

            await expect(service.resolve(em, "ws-1", [{ kind: "member", id: MINH }], "vi")).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MentionUnknown,
                params: { kind: "member" },
            })
        })

        it("refuses an agent that is not an active agent of the workspace", async () => {
            const em = mockEntityManager(stubsOf({ agents: [] }))
            const { service } = await build(em)

            await expect(service.resolve(em, "ws-1", [{ kind: "agent", id: SALES_AI }], "vi")).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MentionUnknown,
            })
        })

        it("refuses a room nobody sits in", async () => {
            const em = mockEntityManager(stubsOf({ rooms: [] }))
            const { service } = await build(em)

            await expect(service.resolve(em, "ws-1", [{ kind: "group", id: "room:care" }], "vi")).rejects.toMatchObject(
                {
                    code: ThreadMessagesErrorCode.MentionUnknown,
                    params: { kind: "group" },
                },
            )
        })
    })
}

const registerIdentity = () => {
    describe("identity", () => {
        it("finds the member id of a signed-in account", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await expect(service.memberIdOf(em, "ws-1", "auth-user")).resolves.toBe(MINH)
            expect(em.query).toHaveBeenCalledWith(FIND_MEMBER_ID, ["ws-1", "auth-user"])
        })

        it("refuses an account that is not a member of the workspace", async () => {
            const em = mockEntityManager(stubsOf({ memberId: [] }))
            const { service } = await build(em)

            await expect(service.memberIdOf(em, "ws-1", "stranger")).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MemberNotFound,
            })
        })

        it("accepts an active member id and refuses any other", async () => {
            const active = mockEntityManager(stubsOf())
            const absent = mockEntityManager(stubsOf({ people: [] }))
            const { service } = await build(active)

            await expect(service.ensureMember(active, "ws-1", MINH)).resolves.toBeUndefined()
            await expect(service.ensureMember(absent, "ws-1", MINH)).rejects.toMatchObject({
                code: ThreadMessagesErrorCode.MemberNotFound,
            })
        })
    })
}

const registerNames = () => {
    describe("names", () => {
        it("names a member of the workspace and answers empty for one that is not", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)
            const gone = mockEntityManager(stubsOf({ name: [] }))

            await expect(service.nameOfMember(em, "ws-1", MINH)).resolves.toBe("Mr Minh")
            await expect(service.nameOfMember(gone, "ws-1", "nobody")).resolves.toBe("")
        })

        it("maps the active members among some ids to their names", async () => {
            const em = mockEntityManager(stubsOf())
            const { service } = await build(em)

            await expect(service.namesOf(em, "ws-1", [MINH, "left"])).resolves.toEqual({ [MINH]: "Mr Minh" })
        })
    })
}

describe("MentionDirectoryService", () => {
    registerDirectory()
    registerResolve()
    registerIdentity()
    registerNames()
})
