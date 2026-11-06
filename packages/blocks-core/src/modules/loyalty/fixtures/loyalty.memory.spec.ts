import { memoryWorld, putRecord } from "../../accounting/fixtures/accounting.memory"
import { STARTER_PROGRAM } from "../config-store"
import { MEMBERS_LIST } from "../reads/members.read"
import {
    campaignsIn,
    decisionsIn,
    entriesIn,
    loyaltyProvider,
    memberIn,
    membersList,
    programIn,
    putProgram,
    rewardsIn,
    sampleWorld,
} from "./loyalty.memory"

const QUERY = { q: null, filters: {}, sort: "name", cursor: null, size: 30 }

describe("the Loyalty memory world", () => {
    it("refuses a port outside the module", () => {
        const provider = loyaltyProvider(sampleWorld())
        expect(() => provider.implementationOf({ entry: "port", id: "elsewhere.thing" })).toThrow("PORT_UNPROVIDED")
    })

    it("lists without search or filters on a shape that declares neither, and sorts by nothing for an unknown sort", async () => {
        const bare = { sort: MEMBERS_LIST.sort, page: MEMBERS_LIST.page, row: MEMBERS_LIST.row }
        const source = membersList(sampleWorld())
        expect((await source.page(bare, { ...QUERY, sort: "unknown" })).rows).toHaveLength(5)
        expect((await source.page(bare, { ...QUERY, filters: { tier: "dong" } })).rows).toHaveLength(0)
    })

    it("counts the values of a filter that names no field as nothing", async () => {
        expect(await membersList(sampleWorld()).counts(MEMBERS_LIST, "unknown", QUERY)).toEqual({})
    })

    it("reads back what it holds", () => {
        const world = sampleWorld(null)
        expect(programIn(world)).toBeNull()
        expect(memberIn(world, "nobody")).toBeNull()
        putProgram(world, STARTER_PROGRAM)
        expect(programIn(world)).toMatchObject({ version: "1", enabled: false })
    })

    it("skips the records of an entity that are not that entity's", () => {
        const world = memoryWorld()
        for (const entity of ["loyalty.ledger-entry", "loyalty.reward", "loyalty.campaign", "loyalty.decision"])
            putRecord(world, entity, "g1", { name: 1, status: "waiting", memberId: 1 })
        expect(entriesIn(world)).toEqual([])
        expect(rewardsIn(world)).toEqual([])
        expect(campaignsIn(world)).toEqual([])
        expect(decisionsIn(world)).toEqual([])
    })

    it("reads a ledger entry whose customer is not a text as an entry of no customer", () => {
        const world = memoryWorld()
        putRecord(world, "loyalty.ledger-entry", "e1", {
            kind: "earn",
            points: 1,
            by: "x",
            occurredAt: "2026-01-01T00:00:00.000Z",
            memberId: 5,
        })
        expect(entriesIn(world)).toMatchObject([{ id: "e1", customerId: "" }])
    })
})
