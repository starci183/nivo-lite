import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import {
    DONG_VI,
    PRICE_30K_PER_ORDER_VI,
    PRICE_30K_VI,
    PRICE_32K_PER_ORDER_VI,
} from "@tests/fixtures/i18n/brain-facts-spec.messages"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"

describe("BrainChangeRequestsService: the value is matched with its unit, in the store's one normal form (D-T5-1)", () => {
    it("files nothing when the value in force says it in the other form (number and unit apart vs unit inside the value)", async () => {
        const { requests, facts: store } = await facts.buildChangeRequests()
        const active = facts.factOf({ id: "f1", status: "active", value: "30.000", unit: DONG_VI })
        store.byKey.mockResolvedValueOnce([active])

        await expect(requests.propose(facts.WS, facts.changeRequestOf({ value: PRICE_30K_VI, unit: DONG_VI }))).resolves.toEqual({
            outcome: "already_true",
            fact: active,
        })
        expect(store.propose).not.toHaveBeenCalled()
    })

    it("answers already_filed when the same value with its unit already waits", async () => {
        const { requests, facts: store } = await facts.buildChangeRequests()
        const waiting = facts.factOf({ id: "p0", status: "proposed", value: PRICE_32K_PER_ORDER_VI, unit: null })
        // No value in force, no plan (D-BR-6), then the same value waiting.
        store.byKey.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([waiting])
        store.propose.mockResolvedValue({ fact: waiting, outcome: "proposed" })

        await expect(
            requests.propose(facts.WS, facts.changeRequestOf({ value: PRICE_32K_PER_ORDER_VI, unit: DONG_VI })),
        ).resolves.toEqual({
            outcome: "already_filed",
            fact: waiting,
        })
    })

    it("hands the store the agent's value and unit as given: the store owns the normal form (`unitFormOf`)", async () => {
        const { requests, facts: store } = await facts.buildChangeRequests()
        const active = facts.factOf({ id: "f1", status: "active", value: PRICE_30K_PER_ORDER_VI, unit: null })
        const proposal = facts.factOf({ id: "p1", status: "proposed", value: PRICE_32K_PER_ORDER_VI, unit: null })
        store.byKey.mockResolvedValueOnce([active])
        store.propose.mockResolvedValue({ fact: proposal, outcome: "conflict" })

        await requests.propose(facts.WS, facts.changeRequestOf({ value: PRICE_32K_PER_ORDER_VI, unit: DONG_VI }))

        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ value: PRICE_32K_PER_ORDER_VI, unit: DONG_VI })
    })
})

const PLAN = facts.factOf({
    id: "plan",
    status: "scheduled",
    value: "30k",
    scope: "public",
    validFrom: "2027-02-12T00:00:00.000Z",
    validTo: "2027-02-15T00:00:00.000Z",
})

/** The store with no value in force of the key and one plan of it, workspace-wide. */
const planned = async () => {
    const world = await facts.buildChangeRequests()
    world.facts.byKey.mockImplementation((_ws, _subject, _attribute, status, installationId) =>
        Promise.resolve(status === "scheduled" && installationId === null ? [PLAN] : []),
    )
    world.facts.propose.mockResolvedValue({
        fact: facts.factOf({ id: "p1", status: "proposed" }),
        outcome: "proposed",
    })
    return world
}

describe("D-BR-6: a truth whose only value is PLANNED is changed as that truth, never added beside its plan", () => {
    it("files a line with no period as the next version of the plan: its key, its audience and its window (it replaces the plan)", async () => {
        const { requests, facts: store } = await planned()

        await requests.propose(facts.WS, facts.changeRequestOf({ value: "35k" }))

        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({
            value: "35k",
            scope: "public",
            installationId: null,
            validFrom: "2027-02-12T00:00:00.000Z",
            validTo: "2027-02-15T00:00:00.000Z",
        })
    })

    it("files a line with its own start as its own period: the plan stays and still takes over at its start", async () => {
        const { requests, facts: store } = await planned()

        await requests.propose(facts.WS, facts.changeRequestOf({ value: "25k", validFrom: "2026-10-12T10:00:00.000Z" }))

        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({
            validFrom: "2026-10-12T10:00:00.000Z",
            validTo: null,
            scope: "public",
        })
    })

    it("answers already_true when the plan already says the value", async () => {
        const { requests, facts: store } = await planned()

        await expect(requests.propose(facts.WS, facts.changeRequestOf({ value: "30k" }))).resolves.toEqual({
            outcome: "already_true",
            fact: PLAN,
        })
        expect(store.propose).not.toHaveBeenCalled()
    })

    it("accepts the plan named by id (replaces) and still refuses a fact that is neither in force nor planned", async () => {
        const { requests, facts: store } = await planned()
        store.get.mockResolvedValueOnce(PLAN).mockResolvedValueOnce(facts.factOf({ id: "old", status: "superseded" }))

        await requests.propose(facts.WS, facts.changeRequestOf({ value: "35k", replaces: "plan" }))
        await expect(requests.propose(facts.WS, facts.changeRequestOf({ value: "35k", replaces: "old" }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactNotFound,
        })
        expect(store.propose).toHaveBeenCalledTimes(1)
    })

    it("prefers the value in force over a plan of the same key", async () => {
        const { requests, facts: store } = await planned()
        const active = facts.factOf({ id: "now", status: "active", value: "20k", scope: "internal" })
        store.byKey.mockImplementation((_ws, _subject, _attribute, status) =>
            Promise.resolve(status === "active" ? [active] : status === "scheduled" ? [PLAN] : []),
        )

        await requests.propose(facts.WS, facts.changeRequestOf({ value: "35k" }))

        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ scope: "internal", validFrom: null })
    })
})
