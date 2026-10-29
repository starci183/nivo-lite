import { Test } from "@nestjs/testing"
import {
    isBrainFactEntity as isBrainFactEntityReal,
    keyOf as keyOfReal,
    RETURNED as RETURNEDReal,
    returnedFacts as returnedFactsReal,
    scopeOf as scopeOfReal,
} from "./fact-columns.policy"
import { IsNull } from "typeorm"

const SUBJECT = Symbol("fact-columns.policy")

let isBrainFactEntity: typeof isBrainFactEntityReal
let keyOf: typeof keyOfReal
let RETURNED: typeof RETURNEDReal
let returnedFacts: typeof returnedFactsReal
let scopeOf: typeof scopeOfReal

beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    isBrainFactEntity: isBrainFactEntityReal,
                    keyOf: keyOfReal,
                    RETURNED: RETURNEDReal,
                    returnedFacts: returnedFactsReal,
                    scopeOf: scopeOfReal,
                },
            },
        ],
    }).compile()
    ;({ isBrainFactEntity, keyOf, RETURNED, returnedFacts, scopeOf } = moduleRef.get<{
        isBrainFactEntity: typeof isBrainFactEntityReal
        keyOf: typeof keyOfReal
        RETURNED: typeof RETURNEDReal
        returnedFacts: typeof returnedFactsReal
        scopeOf: typeof scopeOfReal
    }>(SUBJECT))
})

const row = (id: string, subjectKey: string): Record<string, unknown> => ({ id, subjectKey, attribute: "price" })

describe("fact-columns.policy", () => {
    describe("RETURNED", () => {
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

    describe("isBrainFactEntity", () => {
        it("accepts an object whose id and subjectKey are text", () => {
            expect(isBrainFactEntity(row("f-1", "menu"))).toBe(true)
        })

        it("refuses what is not an object", () => {
            expect(isBrainFactEntity(null)).toBe(false)
            expect(isBrainFactEntity("f-1")).toBe(false)
            expect(isBrainFactEntity(undefined)).toBe(false)
        })

        it("refuses an object missing a text id or subjectKey", () => {
            expect(isBrainFactEntity({ id: "f-1" })).toBe(false)
            expect(isBrainFactEntity({ id: 1, subjectKey: "menu" })).toBe(false)
            expect(isBrainFactEntity({ subjectKey: "menu" })).toBe(false)
        })
    })

    describe("returnedFacts", () => {
        it("keeps only the rows shaped like a fact", () => {
            const good = row("f-1", "menu")

            expect(returnedFacts([good, { id: "f-2" }, null, row("f-3", "hours")])).toEqual([good, row("f-3", "hours")])
        })

        it("answers no rows when the driver gave something other than a list", () => {
            expect(returnedFacts(undefined)).toEqual([])
            expect(returnedFacts({ id: "f-1", subjectKey: "menu" })).toEqual([])
        })
    })

    describe("scopeOf", () => {
        it("turns the workspace-wide scope into IS NULL", () => {
            expect(scopeOf(null)).toEqual(IsNull())
        })

        it("keeps an installation id as it is", () => {
            expect(scopeOf("inst-1")).toBe("inst-1")
        })
    })

    describe("keyOf", () => {
        it("builds the condition of one key in an installation", () => {
            expect(keyOf("ws-1", "menu", "price", "inst-1")).toEqual({
                workspaceId: "ws-1",
                subjectKey: "menu",
                attribute: "price",
                installationId: "inst-1",
            })
        })

        it("scopes a workspace-wide key with IS NULL", () => {
            expect(keyOf("ws-1", "menu", "price", null)).toEqual({
                workspaceId: "ws-1",
                subjectKey: "menu",
                attribute: "price",
                installationId: IsNull(),
            })
        })
    })
})
