import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/fake-query-builder.builder"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { OfficeRoomMembersService } from "./office-room-members.service"

/** The statement `callDbFunction` runs for the Auth-side photos. */
const LIST_MEMBER_AVATARS = "SELECT * FROM be_access.workspace_member_avatars($1, $2)"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [OfficeRoomMembersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(OfficeRoomMembersService)
}

const person = (seat: string, user: string, name: string, at: string, key?: string) => ({
    key,
    seat_id: seat,
    id: user,
    name,
    module: null,
    avatar_url: null,
    at,
})

const agent = (id: string, name: string, at: string, key?: string) => ({
    key,
    seat_id: id,
    id,
    name,
    module: "content",
    avatar_url: `https://example.com/${id}.png`,
    at,
})

const MAI = { id: "u-1", kind: "human", module: null, name: "Mai Linh", avatarUrl: "https://example.com/mai.png" }

/** The answers of the four Office room reads, in the order the service runs them. */
const officeAnswers = (): ReadonlyArray<QueryBuilderAnswers> => [
    { getRawOne: { count: 2 } },
    { getRawOne: { count: 1 } },
    {
        getRawMany: [
            person("m-1", "u-1", "Mai Linh", "20261001000000000000"),
            person("m-2", "u-2", "An", "20261003000000000000"),
        ],
    },
    { getRawMany: [agent("a-1", "AI Marketing", "20261002000000000000")] },
]

describe("OfficeRoomMembersService.read the Office room", () => {
    it("reads in one repeatable-read transaction and orders the preview by time", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, [{ id: "u-1", avatar_url: MAI.avatarUrl }]] })
        fakeTransaction(em)
        queueSubQueryBuilders(em, officeAnswers())
        const service = await build(em)

        const views = await service.read("ws-1", [])

        expect(em.transaction).toHaveBeenCalledWith("REPEATABLE READ", expect.any(Function))
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(4)
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
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: { count: 4 } },
            { getRawOne: { count: 3 } },
            { getRawMany: [1, 2, 3, 4].map((n) => person(`m-${n}`, `u-${n}`, `P${n}`, `2026100${n}000000000000`)) },
            { getRawMany: [agent("a-1", "A1", "20261001000000000000"), agent("a-2", "A2", "20261002000000000000")] },
        ])
        const service = await build(em)

        const office = (await service.read("ws-1", [])).get(null)

        expect(office?.count).toBe(7)
        expect(office?.preview.map((member) => member.name)).toEqual(["A1", "P1", "A2", "P2"])
    })

    it("breaks a time tie by seat id and then by kind", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, []] })
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: { count: 2 } },
            { getRawOne: { count: 2 } },
            {
                getRawMany: [
                    person("0b", "u-b", "B", "20261001000000000000"),
                    person("0a", "u-a", "A", "20261001000000000000"),
                ],
            },
            { getRawMany: [agent("0a", "Agent", "20261001000000000000"), agent("0c", "C", "20261001000000000000")] },
        ])
        const service = await build(em)

        const office = (await service.read("ws-1", [])).get(null)

        expect(office?.preview.map((member) => member.name)).toEqual(["Agent", "A", "B", "C"])
    })
})

describe("OfficeRoomMembersService.read the Office room ties", () => {
    it("keeps seats that are equal in time, seat and kind in the order they came, agents before people", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, []] })
        fakeTransaction(em)
        const at = "20261001000000000000"
        queueSubQueryBuilders(em, [
            { getRawOne: { count: 2 } },
            { getRawOne: { count: 2 } },
            { getRawMany: [person("0a", "u-1", "First", at), person("0a", "u-2", "Second", at)] },
            { getRawMany: [agent("0a", "Alpha", at), agent("0a", "Beta", at)] },
        ])
        const service = await build(em)

        const office = (await service.read("ws-1", [])).get(null)

        expect(office?.preview.map((member) => member.name)).toEqual(["Alpha", "Beta", "First", "Second"])
    })

    it("orders the same whichever of two seats the sort hands over first", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, []] })
        fakeTransaction(em)
        const at = "20261001000000000000"
        queueSubQueryBuilders(em, [
            { getRawOne: { count: 1 } },
            { getRawOne: { count: 1 } },
            { getRawMany: [person("0a", "u-1", "Human", at)] },
            { getRawMany: [agent("0a", "Agent", at)] },
        ])
        const service = await build(em)
        const reversed = jest.spyOn(Array.prototype, "sort").mockImplementation(function (
            this: Array<unknown>,
            compare?: (left: unknown, right: unknown) => number,
        ) {
            const order = compare ?? (() => 0)
            for (let index = 1; index < this.length; index += 1) {
                const item = this[index]
                let cursor = index - 1
                while (cursor >= 0 && order(this[cursor], item) > 0) {
                    this[cursor + 1] = this[cursor]
                    cursor -= 1
                }
                this[cursor + 1] = item
            }
            return this
        })

        try {
            const office = (await service.read("ws-1", [])).get(null)

            expect(office?.preview.map((member) => member.name)).toEqual(["Agent", "Human"])
        } finally {
            reversed.mockRestore()
        }
    })
})

describe("OfficeRoomMembersService.read the Office room without seats", () => {
    it("asks Auth for no photos when no person is previewed", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: { count: 0 } },
            { getRawOne: { count: 1 } },
            { getRawMany: [] },
            { getRawMany: [agent("a-1", "AI Marketing", "20261002000000000000")] },
        ])
        const service = await build(em)

        const office = (await service.read("ws-1", [])).get(null)

        expect(office?.count).toBe(1)
        expect(em.query).not.toHaveBeenCalled()
    })

    it("answers a count of zero when the reads come back empty", async () => {
        const em = mockEntityManager()
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: undefined },
            { getRawOne: undefined },
            { getRawMany: [] },
            { getRawMany: [] },
        ])
        const service = await build(em)

        await expect(service.read("ws-1", [])).resolves.toEqual(new Map([[null, { count: 0, preview: [] }]]))
    })
})

describe("OfficeRoomMembersService.read the department rooms", () => {
    it("reads seated people and agents per room and falls back to owners and managers for an unseated one", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, [{ id: "u-3", avatar_url: null }]] })
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            ...officeAnswers(),
            { getRawMany: [{ key: "sales", count: 2 }] },
            {
                getRawMany: [
                    { key: "sales", count: 1 },
                    { key: "care", count: 1 },
                ],
            },
            { getRawOne: { count: 2 } },
            {},
            {
                getRawMany: [
                    person("s-1", "u-3", "Seated", "20261005000000000000", "sales"),
                    person("s-2", "u-4", "Also seated", "20261006000000000000", "sales"),
                ],
            },
            {},
            {
                getRawMany: [
                    agent("a-5", "Sales agent", "20261004000000000000", "sales"),
                    agent("a-6", "Care agent", "20261004000000000000", "care"),
                ],
            },
            { getRawMany: [person("m-1", "u-1", "Owner", "20261001000000000000")] },
        ])
        const service = await build(em)

        const views = await service.read("ws-1", ["sales", "care", "frontdesk"])

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(12)
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

describe("OfficeRoomMembersService.read rooms with partial facts", () => {
    it("counts a room whose seats or head counts the reads left out, and skips facts with no room", async () => {
        const em = mockEntityManager({ query: [LIST_MEMBER_AVATARS, []] })
        fakeTransaction(em)
        queueSubQueryBuilders(em, [
            { getRawOne: { count: 0 } },
            { getRawOne: { count: 0 } },
            { getRawMany: [] },
            { getRawMany: [] },
            { getRawMany: [{ key: "sales", count: 2 }, { count: 7 }] },
            { getRawMany: [] },
            { getRawOne: undefined },
            {},
            { getRawMany: [person("s-9", "u-9", "No room", "20261005000000000000")] },
            {},
            { getRawMany: [] },
            { getRawMany: [] },
        ])
        const service = await build(em)

        const views = await service.read("ws-1", ["sales", "care"])

        expect(views.get("sales")).toEqual({ count: 2, preview: [] })
        expect(views.get("care")).toEqual({ count: 0, preview: [] })
    })
})
