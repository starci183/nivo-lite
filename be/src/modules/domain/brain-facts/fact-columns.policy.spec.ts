import { IsNull } from "typeorm"
import { Test } from "@nestjs/testing"
import {
    isBrainFactEntity as realIsBrainFactEntity,
    returnedFacts as realReturnedFacts,
    scopeOf as realScopeOf,
    factKeyOf as realFactKeyOf,
    RETURNED,
} from "./fact-columns.policy"

const SUBJECT = Symbol("fact-columns.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isBrainFactEntity: realIsBrainFactEntity,
                    returnedFacts: realReturnedFacts,
                    scopeOf: realScopeOf,
                    factKeyOf: realFactKeyOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        isBrainFactEntity: typeof realIsBrainFactEntity
        returnedFacts: typeof realReturnedFacts
        scopeOf: typeof realScopeOf
        factKeyOf: typeof realFactKeyOf
    }>(SUBJECT)
}

const row = (id: string, subjectKey: string): Record<string, unknown> => ({ id, subjectKey, attribute: "price" })

describe("fact-columns.policy RETURNED", () => {
    it("lists every column of a write, aliasing the snake_case ones to entity properties", () => {
        const columns = RETURNED.split(", ")

        expect(columns).toHaveLength(27)
        expect(columns.slice(0, 3)).toEqual([
            "id",
            'workspace_id AS "workspaceId"',
            'installation_id AS "installationId"',
        ])
        expect(columns).toContain('proposal_kind AS "proposalKind"')
        expect(columns).toContain("evidence")
    })
})

describe("fact-columns.policy isBrainFactEntity", () => {
    it("accepts an object whose id and subjectKey are text", async () => {
        const policy = await build()

        expect(policy.isBrainFactEntity(row("f-1", "menu"))).toBe(true)
    })

    it("refuses what is not an object", async () => {
        const policy = await build()

        expect(policy.isBrainFactEntity(null)).toBe(false)
        expect(policy.isBrainFactEntity("f-1")).toBe(false)
        expect(policy.isBrainFactEntity(undefined)).toBe(false)
    })

    it("refuses an object missing a text id or subjectKey", async () => {
        const policy = await build()

        expect(policy.isBrainFactEntity({ id: "f-1" })).toBe(false)
        expect(policy.isBrainFactEntity({ id: 1, subjectKey: "menu" })).toBe(false)
        expect(policy.isBrainFactEntity({ subjectKey: "menu" })).toBe(false)
    })
})

describe("fact-columns.policy returnedFacts", () => {
    it("keeps only the rows shaped like a fact", async () => {
        const policy = await build()

        const good = row("f-1", "menu")

        expect(policy.returnedFacts([good, { id: "f-2" }, null, row("f-3", "hours")])).toEqual([
            good,
            row("f-3", "hours"),
        ])
    })

    it("answers no rows when the driver gave something other than a list", async () => {
        const policy = await build()

        expect(policy.returnedFacts(undefined)).toEqual([])
        expect(policy.returnedFacts({ id: "f-1", subjectKey: "menu" })).toEqual([])
    })
})

describe("fact-columns.policy scopeOf", () => {
    it("turns the workspace-wide scope into IS NULL", async () => {
        const policy = await build()

        expect(policy.scopeOf(null)).toEqual(IsNull())
    })

    it("keeps an installation id as it is", async () => {
        const policy = await build()

        expect(policy.scopeOf("inst-1")).toBe("inst-1")
    })
})

describe("fact-columns.policy factKeyOf", () => {
    it("builds the condition of one key in an installation", async () => {
        const policy = await build()

        expect(policy.factKeyOf("ws-1", "menu", "price", "inst-1")).toEqual({
            workspaceId: "ws-1",
            subjectKey: "menu",
            attribute: "price",
            installationId: "inst-1",
        })
    })

    it("scopes a workspace-wide key with IS NULL", async () => {
        const policy = await build()

        expect(policy.factKeyOf("ws-1", "menu", "price", null)).toEqual({
            workspaceId: "ws-1",
            subjectKey: "menu",
            attribute: "price",
            installationId: IsNull(),
        })
    })
})
