import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { MemberSeat } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeRoomMembersService } from "./office-room-members.service"
import { OFFICE_ROOMS_AGENTS } from "./office-rooms.decorators"
import type { RoomAgentSeat, RoomsAgents } from "./office-rooms.port"

/** The statement `callDbFunction` runs for the Auth-side photos. */
const LIST_MEMBER_AVATARS = 'SELECT * FROM "be_access"."workspace_member_avatars"($1, $2)'

const person = (seat: string, user: string, name: string, at: string): MemberSeat => ({
    seat_id: seat,
    id: user,
    name,
    at,
})

const agent = (id: string, name: string, at: string): RoomAgentSeat => ({
    id,
    name,
    module: "content",
    avatar_url: `https://example.com/${id}.png`,
    at,
})

/** Who sits in a seat: an account or an agent. */
interface SeatWho {
    /** The account id. */
    readonly user?: string
    /** The agent id. */
    readonly agent?: string
}

const seatRow = (key: string, seat: string, who: SeatWho, at: string) => ({
    key,
    seat_id: seat,
    user_id: who.user ?? null,
    agent_id: who.agent ?? null,
    at,
})

const MAI = { id: "u-1", kind: "human", module: null, name: "Mai Linh", avatarUrl: "https://example.com/mai.png" }

/** What the owner capabilities answer; every read defaults to an empty workspace. */
interface Answers {
    readonly activeCount?: number
    readonly agentCount?: number
    readonly firstActive?: Array<MemberSeat>
    readonly firstSeats?: Array<RoomAgentSeat>
    readonly activeByUserIds?: Array<MemberSeat>
    readonly seatsOf?: Array<RoomAgentSeat>
    readonly stewardCount?: number
    readonly firstStewards?: Array<MemberSeat>
}

const build = async (entityManager: MockEntityManager, answers: Answers = {}) => {
    const people = mock<WorkspaceMembersReadService>({
        activeCount: jest.fn(() => Promise.resolve(answers.activeCount ?? 0)),
        firstActive: jest.fn(() => Promise.resolve(answers.firstActive ?? [])),
        activeByUserIds: jest.fn(() => Promise.resolve(answers.activeByUserIds ?? [])),
        stewardCount: jest.fn(() => Promise.resolve(answers.stewardCount ?? 0)),
        firstStewards: jest.fn(() => Promise.resolve(answers.firstStewards ?? [])),
    })
    const agents = mock<RoomsAgents>({
        countOf: jest.fn(() => Promise.resolve(answers.agentCount ?? 0)),
        firstSeats: jest.fn(() => Promise.resolve(answers.firstSeats ?? [])),
        seatsOf: jest.fn(() => Promise.resolve(answers.seatsOf ?? [])),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OfficeRoomMembersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersReadService, useValue: people },
            { provide: OFFICE_ROOMS_AGENTS, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(OfficeRoomMembersService), people, agents }
}

describe("OfficeRoomMembersService.read the Office room", () => {
    it("counts every active account and agent and orders the preview by time", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, [{ id: "u-1", avatar_url: MAI.avatarUrl }]] })
        const { service, people, agents } = await build(em, {
            activeCount: 2,
            agentCount: 1,
            firstActive: [
                person("m-1", "u-1", "Mai Linh", "20261001000000000000"),
                person("m-2", "u-2", "An", "20261003000000000000"),
            ],
            firstSeats: [agent("a-1", "AI Marketing", "20261002000000000000")],
        })

        const views = await service.read("ws-1", [])

        expect(people.firstActive).toHaveBeenCalledWith("ws-1", 4)
        expect(agents.firstSeats).toHaveBeenCalledWith("ws-1", 4)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.query).toHaveBeenCalledWith(LIST_MEMBER_AVATARS, ["ws-1", ["u-1", "u-2"]])
        expect([...views.keys()]).toEqual([null])
        expect(views.get(null)).toEqual({
            count: 3,
            preview: [
                MAI,
                {
                    id: "a-1",
                    kind: "agent",
                    module: "content",
                    name: "AI Marketing",
                    avatarUrl: "https://example.com/a-1.png",
                },
                { id: "u-2", kind: "human", module: null, name: "An", avatarUrl: null },
            ],
        })
    })

    it("cuts the preview at four members across people and agents", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, []] })
        const { service } = await build(em, {
            activeCount: 4,
            agentCount: 3,
            firstActive: [1, 2, 3, 4].map((n) => person(`m-${n}`, `u-${n}`, `P${n}`, `2026100${n}000000000000`)),
            firstSeats: [agent("a-1", "A1", "20261001000000000000"), agent("a-2", "A2", "20261002000000000000")],
        })

        const office = (await service.read("ws-1", [])).get(null)

        expect(office?.count).toBe(7)
        expect(office?.preview.map((member) => member.name)).toEqual(["A1", "P1", "A2", "P2"])
    })

    it("breaks a time tie by seat id and then by kind", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, []] })
        const { service } = await build(em, {
            activeCount: 2,
            agentCount: 2,
            firstActive: [
                person("0b", "u-b", "B", "20261001000000000000"),
                person("0a", "u-a", "A", "20261001000000000000"),
            ],
            firstSeats: [agent("0a", "Agent", "20261001000000000000"), agent("0c", "C", "20261001000000000000")],
        })

        const office = (await service.read("ws-1", [])).get(null)

        expect(office?.preview.map((member) => member.name)).toEqual(["Agent", "A", "B", "C"])
    })
})

describe("OfficeRoomMembersService.read an almost empty Office room", () => {
    it("asks Auth for no photos when no person is previewed", async () => {
        const em = mockEntityManager()
        const { service } = await build(em, {
            agentCount: 1,
            firstSeats: [agent("a-1", "AI Marketing", "20261002000000000000")],
        })

        const office = (await service.read("ws-1", [])).get(null)

        expect(office?.count).toBe(1)
        expect(em.query).not.toHaveBeenCalled()
    })

    it("answers a count of zero when the workspace is empty", async () => {
        const { service } = await build(mockEntityManager())

        await expect(service.read("ws-1", [])).resolves.toEqual(new Map([[null, { count: 0, preview: [] }]]))
    })
})

describe("OfficeRoomMembersService.read the department rooms", () => {
    it("reads seated people and agents per room and falls back to owners and managers for an unseated one", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, [{ id: "u-3", avatar_url: null }]] })
        const [seats] = queueSubQueryBuilders(em, [
            {
                getRawMany: [
                    seatRow("care", "c-1", { agent: "a-6" }, "20261004000000000000"),
                    seatRow("sales", "s-0", { agent: "a-gone" }, "20261003000000000000"),
                    seatRow("sales", "s-1", { user: "u-3" }, "20261005000000000000"),
                    seatRow("sales", "s-2", { user: "u-4" }, "20261006000000000000"),
                    seatRow("sales", "s-3", { user: "u-left" }, "20261006000000000000"),
                    seatRow("sales", "s-4", { agent: "a-5" }, "20261004000000000000"),
                ],
            },
        ])
        const { service, people, agents } = await build(em, {
            activeByUserIds: [
                person("m-3", "u-3", "Seated", "20261001000000000000"),
                person("m-4", "u-4", "Also seated", "20261001000000000000"),
            ],
            seatsOf: [
                agent("a-5", "Sales agent", "20261001000000000000"),
                agent("a-6", "Care agent", "20261001000000000000"),
            ],
            stewardCount: 2,
            firstStewards: [person("m-1", "u-1", "Owner", "20261001000000000000")],
        })

        const views = await service.read("ws-1", ["sales", "care", "frontdesk"])

        expect(seats?.argsOf("where")).toContainEqual([
            "r.workspace_id = :workspaceId AND r.key IN (:...keys)",
            { workspaceId: "ws-1", keys: ["sales", "care", "frontdesk"] },
        ])
        expect(seats?.argsOf("limit")).toContainEqual([2000])
        expect(people.activeByUserIds).toHaveBeenCalledWith("ws-1", ["u-3", "u-4", "u-left"])
        expect(agents.seatsOf).toHaveBeenCalledWith("ws-1", ["a-6", "a-gone", "a-5"])
        expect(views.get("sales")).toEqual({
            count: 3,
            preview: [
                {
                    id: "a-5",
                    kind: "agent",
                    module: "content",
                    name: "Sales agent",
                    avatarUrl: "https://example.com/a-5.png",
                },
                { id: "u-3", kind: "human", module: null, name: "Seated", avatarUrl: null },
                { id: "u-4", kind: "human", module: null, name: "Also seated", avatarUrl: null },
            ],
        })
        expect(views.get("care")).toEqual({
            count: 3,
            preview: [
                { id: "u-1", kind: "human", module: null, name: "Owner", avatarUrl: null },
                {
                    id: "a-6",
                    kind: "agent",
                    module: "content",
                    name: "Care agent",
                    avatarUrl: "https://example.com/a-6.png",
                },
            ],
        })
        expect(views.get("frontdesk")).toEqual({
            count: 2,
            preview: [{ id: "u-1", kind: "human", module: null, name: "Owner", avatarUrl: null }],
        })
    })
})
