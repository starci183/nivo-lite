import { Test } from "@nestjs/testing"
import { IsNull } from "typeorm"
import * as policy from "./fact-columns.policy"

const SUBJECT = Symbol("fact-columns.policy")

const subjectOf = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: policy }],
    }).compile()
    return moduleRef.get<typeof import("./fact-columns.policy")>(SUBJECT)
}

const row = (id: string, subjectKey: string): Record<string, unknown> => ({ id, subjectKey, attribute: "price" })

describe("fact-columns.policy", () => {
    describe("RETURNED", () => {
        it("lists every column of a write, aliasing the snake_case ones to entity properties", async () => {
            const { RETURNED } = await subjectOf()

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

    describe("isBrainFactEntity", () => {
        it("accepts an object whose id and subjectKey are text", async () => {
            const { isBrainFactEntity } = await subjectOf()

            expect(isBrainFactEntity(row("f-1", "menu"))).toBe(true)
        })

        it("refuses what is not an object", async () => {
            const { isBrainFactEntity } = await subjectOf()

            expect(isBrainFactEntity(null)).toBe(false)
            expect(isBrainFactEntity("f-1")).toBe(false)
            expect(isBrainFactEntity(undefined)).toBe(false)
        })

        it("refuses an object missing a text id or subjectKey", async () => {
            const { isBrainFactEntity } = await subjectOf()

            expect(isBrainFactEntity({ id: "f-1" })).toBe(false)
            expect(isBrainFactEntity({ id: 1, subjectKey: "menu" })).toBe(false)
            expect(isBrainFactEntity({ subjectKey: "menu" })).toBe(false)
        })
    })

    describe("returnedFacts", () => {
        it("keeps only the rows shaped like a fact", async () => {
            const { returnedFacts } = await subjectOf()

            const good = row("f-1", "menu")

            expect(returnedFacts([good, { id: "f-2" }, null, row("f-3", "hours")])).toEqual([good, row("f-3", "hours")])
        })

        it("answers no rows when the driver gave something other than a list", async () => {
            const { returnedFacts } = await subjectOf()

            expect(returnedFacts(undefined)).toEqual([])
            expect(returnedFacts({ id: "f-1", subjectKey: "menu" })).toEqual([])
        })
    })

    describe("scopeOf", () => {
        it("turns the workspace-wide scope into IS NULL", async () => {
            const { scopeOf } = await subjectOf()

            expect(scopeOf(null)).toEqual(IsNull())
        })

        it("keeps an installation id as it is", async () => {
            const { scopeOf } = await subjectOf()

            expect(scopeOf("inst-1")).toBe("inst-1")
        })
    })

    describe("factKeyOf", () => {
        it("builds the condition of one key in an installation", async () => {
            const { factKeyOf } = await subjectOf()

            expect(factKeyOf("ws-1", "menu", "price", "inst-1")).toEqual({
                workspaceId: "ws-1",
                subjectKey: "menu",
                attribute: "price",
                installationId: "inst-1",
            })
        })

        it("scopes a workspace-wide key with IS NULL", async () => {
            const { factKeyOf } = await subjectOf()

            expect(factKeyOf("ws-1", "menu", "price", null)).toEqual({
                workspaceId: "ws-1",
                subjectKey: "menu",
                attribute: "price",
                installationId: IsNull(),
            })
        })
    })
})
