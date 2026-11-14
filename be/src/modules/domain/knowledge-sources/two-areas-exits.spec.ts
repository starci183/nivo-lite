import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { BrainFactsReadService, brainFactsEntities, readersAfterMove } from "@modules/domain/brain-facts"
import { PassageSearchService } from "@modules/domain/knowledge-chunks"
import type { DocumentVisibility } from "./knowledge-sources.contracts"
import { KnowledgeSourcesReadableService } from "./knowledge-sources-readable.service"

/**
 * THE EXITS of the two upload areas (owner 2026-11-12): customer-facing reads take the PUBLIC area only, the team reads both. Each exit
 * is proven at its service, over the state a document of a bicycle workshop is in: its area, whether the security read has served its
 * passages (`customer_ready`), and the audience its truth took from its area (`readersAfterMove`, the move's own rule).
 */
const WS = "11111111-1111-4111-8111-111111111111"
const [BrainFactEntity] = brainFactsEntities
const customerView = { workspaceId: WS, module: "chatbot", installationId: null, audience: "customer" as const }
const teamView = { ...customerView, audience: "internal" as const }

/** Where the workshop's tune-up price list stands. */
interface DocumentState {
    /** Its area. */
    readonly area: DocumentVisibility
    /** Whether the security read served its passages to customers (the trust gate). */
    readonly served: boolean
}

/** The document row the readable statement answers for this state (the gate's counts read in the same statement). */
const documentRowOf = (state: DocumentState) => ({
    id: "s1",
    title: "Tune-up prices",
    topic: null,
    kind: "text",
    visibility: state.area,
    content: "Tune-up 150.000 d",
    module: null,
    installationId: null,
    updatedAt: facts.AT,
    passages: 1,
    served: state.served ? 1 : 0,
    servedText: state.served ? "Tune-up 150.000 d" : null,
})

/** The whole-document exit, over the row the statement answers. */
const readableFor = async (state: DocumentState, audience: "customer" | "internal") => {
    const em = mockEntityManager()
    const [statement] = queueQueryBuilders(em, [{ getRawMany: [documentRowOf(state)] }])
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeSourcesReadableService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    const view = audience === "customer" ? customerView : teamView
    const read = await moduleRef.get(KnowledgeSourcesReadableService).readableFor(view, 10)
    return { ids: read.map((one) => one.id), statement }
}

/** The truth read from the document, with the audience its area gave it, and what an agent's view of it answers. */
const truthViewFor = async (state: DocumentState, audience: "customer" | "internal") => {
    const read = facts.rowOf({ id: "t1", status: "active", scope: "internal", sourceKind: "document" })
    const after = readersAfterMove(
        { scope: "internal", modules: [], decidedBy: "NIVO", decisionNote: null, sourceKind: "document" },
        state.area === "public",
    )
    const row = { ...read, scope: after?.scope ?? read.scope }
    const em = mockEntityManager({ find: [BrainFactEntity, [row]] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactsReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    const seen = await moduleRef.get(BrainFactsReadService).forView(WS, audience, "chatbot", null, 50)
    return seen.map((fact) => fact.id)
}

/** The conditions the passage exit adds for one audience, in the statement itself. */
const passageConditionsFor = async (audience: "customer" | "internal") => {
    const em = mockEntityManager()
    const [statement] = queueQueryBuilders(em, [{ getRawOne: undefined }])
    const moduleRef = await Test.createTestingModule({
        providers: [PassageSearchService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    await moduleRef.get(PassageSearchService).one({ ...customerView, audience }, "c1")
    return statement?.callsOf("andWhere").filter(([first]) => typeof first === "string") ?? []
}

describe("the two areas: an internal document's line never reaches a customer read", () => {
    const internal: DocumentState = { area: "internal", served: true }

    it("the whole-document read holds a customer view to the public area, in the statement and on every row", async () => {
        const customer = await readableFor(internal, "customer")
        expect(customer.ids).toEqual([])
        expect(customer.statement?.callsOf("andWhere")).toContainEqual([{ visibility: "public" }])
        await expect(readableFor(internal, "internal")).resolves.toMatchObject({ ids: ["s1"] })
    })

    it("the passage search and read (the agents' passage tools) serve a customer lens public, released passages only", async () => {
        await expect(passageConditionsFor("customer")).resolves.toEqual([
            ["c.visibility = :served", { served: "public" }],
            ["c.customer_ready = true"],
            ["c.id = :passageId", { passageId: "c1" }],
        ])
        await expect(passageConditionsFor("internal")).resolves.toEqual([["c.id = :passageId", { passageId: "c1" }]])
    })

    it("a truth read from an internal document is in no customer view, and in the team's", async () => {
        await expect(truthViewFor(internal, "customer")).resolves.toEqual([])
        await expect(truthViewFor(internal, "internal")).resolves.toEqual(["t1"])
    })
})

describe("the two areas: moving a document to public / to internal flips every exit", () => {
    it("internal, then public (once the security read serves it), then internal again: the customer exits follow each move", async () => {
        const steps: ReadonlyArray<readonly [DocumentState, ReadonlyArray<string>]> = [
            [{ area: "internal", served: true }, []],
            // Moved to public: nothing is served before the security read has reviewed its passages.
            [{ area: "public", served: false }, []],
            [{ area: "public", served: true }, ["s1"]],
            [{ area: "internal", served: true }, []],
        ]
        for (const [state, expected] of steps) {
            await expect(readableFor(state, "customer")).resolves.toMatchObject({ ids: expected })
            // The team reads the document in either area.
            await expect(readableFor(state, "internal")).resolves.toMatchObject({ ids: ["s1"] })
        }
    })

    it("its truth is in the customer view exactly while the document is in the public area", async () => {
        await expect(truthViewFor({ area: "internal", served: true }, "customer")).resolves.toEqual([])
        await expect(truthViewFor({ area: "public", served: true }, "customer")).resolves.toEqual(["t1"])
        await expect(truthViewFor({ area: "internal", served: true }, "customer")).resolves.toEqual([])
    })
})
