import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import {
    OPENING_HOURS_ATTRIBUTE_VI,
    OPENING_HOURS_VALUE_VI,
    SHOP_SUBJECT_VI,
} from "@tests/fixtures/i18n/brain-facts-spec.messages"
import { BrainChangeRequestsService, changeEvidenceOf, type ChangeRequestHook } from "./brain-change-requests.service"
import { BrainFactsService } from "./brain-facts.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"

/** The change-requests service built from a testing module over a mocked facts store that has no fact of any key. */
const build = async () => {
    const store = mock<BrainFactsService>()
    store.byKey.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainChangeRequestsService,
            { provide: BrainFactsService, useValue: store },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return { requests: moduleRef.get(BrainChangeRequestsService), facts: store }
}

describe("BrainChangeRequestsService: nivo.tool.brain.change.propose files a proposal and never activates", () => {
    it("files a new value as a proposal on the review path, with the chat message as its evidence", async () => {
        const { requests, facts: store } = await build()
        const proposal = facts.factOf({ id: "p1", value: "9h", status: "proposed", conflictWith: "f1" })
        store.byKey.mockResolvedValueOnce([facts.factOf({ id: "f1", status: "active", value: "8h" })])
        store.propose.mockResolvedValue({ fact: proposal, outcome: "conflict" })

        await expect(requests.propose(facts.WS, facts.changeRequestOf({ validTo: "2026-10-19T00:00:00.000Z" }))).resolves.toEqual({
            outcome: "filed",
            fact: proposal,
        })

        expect(store.propose).toHaveBeenCalledWith(facts.WS, {
            subjectLabel: "Shop",
            attributeLabel: "Hours",
            value: "9h",
            unit: null,
            sourceKind: "staff",
            validFrom: null,
            validTo: "2026-10-19T00:00:00.000Z",
            // The next version keeps who may read the value it replaces.
            scope: "internal",
            modules: [],
            evidence: [
                {
                    kind: "message",
                    ref: `team-chat:${facts.MESSAGE}`,
                    label: "Private chat with an agent",
                    quote: "from Monday we open at 9",
                    at: facts.AT,
                },
            ],
            proposedBy: "sales",
            installationId: null,
            autoApply: false,
        })
        // The founder's decision is the only way in: nothing here applies, chooses or splits.
        expect(store.apply).not.toHaveBeenCalled()
        expect(store.choose).not.toHaveBeenCalled()
        expect(store.split).not.toHaveBeenCalled()
    })

    it("states no audience for a NEW truth from chat, so the store files it internal: only the founder makes it public", async () => {
        const { requests, facts: store } = await build()
        store.propose.mockResolvedValue({ fact: facts.factOf({ id: "p1", status: "proposed" }), outcome: "proposed" })

        await requests.propose(facts.WS, facts.changeRequestOf())

        const [, filed] = store.propose.mock.calls[0] ?? []
        expect(filed).toBeDefined()
        expect(filed).not.toHaveProperty("scope")
        expect(filed).not.toHaveProperty("modules")
    })

    it("never takes the direct path, even for words the owner said in the common chat", async () => {
        const { requests, facts: store } = await build()
        store.propose.mockResolvedValue({ fact: facts.factOf({ status: "proposed" }), outcome: "proposed" })

        await requests.propose(facts.WS, facts.changeRequestOf({ room: "common" }))

        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ autoApply: false, sourceKind: "staff" })
        expect(store.apply).not.toHaveBeenCalled()
    })
})

describe("BrainChangeRequestsService: the same value, a retire request, an incomplete request", () => {
    it("files nothing when the value in force already says it", async () => {
        const { requests, facts: store } = await build()
        const active = facts.factOf({ id: "f1", status: "active", value: "9H" })
        store.byKey.mockResolvedValueOnce([active])

        await expect(requests.propose(facts.WS, facts.changeRequestOf())).resolves.toEqual({
            outcome: "already_true",
            fact: active,
        })
        expect(store.propose).not.toHaveBeenCalled()
    })

    it("answers already_filed when the same value already waits (the message is added to that proposal)", async () => {
        const { requests, facts: store } = await build()
        const waiting = facts.factOf({ id: "p0", status: "proposed", value: "9h" })
        // No value in force, no plan (D-BR-6), then the same value waiting.
        store.byKey.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([waiting])
        store.propose.mockResolvedValue({ fact: waiting, outcome: "proposed" })

        await expect(requests.propose(facts.WS, facts.changeRequestOf())).resolves.toEqual({
            outcome: "already_filed",
            fact: waiting,
        })
    })

    it("files a proposal to stop using the value in force for a request with no value", async () => {
        const { requests, facts: store } = await build()
        const active = facts.factOf({ id: "f1", status: "active" })
        const retire = facts.factOf({ id: "r1", status: "proposed", proposalKind: "retire" })
        store.byKey.mockResolvedValueOnce([active]).mockResolvedValueOnce([retire])
        store.proposeRetire.mockResolvedValue(true)

        await expect(requests.propose(facts.WS, facts.changeRequestOf({ value: null }))).resolves.toEqual({
            outcome: "filed",
            fact: retire,
        })
        expect(store.proposeRetire).toHaveBeenCalledWith(
            facts.WS,
            active,
            changeEvidenceOf(facts.changeRequestOf(), facts.AT),
            "sales",
            "staff",
        )
        expect(store.apply).not.toHaveBeenCalled()
    })

    it("refuses to retire when nothing is in force", async () => {
        const { requests } = await build()

        await expect(requests.propose(facts.WS, facts.changeRequestOf({ value: null }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotActive,
        })
    })

    it.each([
        ["an empty subject", { subjectLabel: "  " }],
        ["an empty quote", { quote: "   " }],
    ])("refuses %s before reading anything", async (_name, changes) => {
        const { requests, facts: store } = await build()

        await expect(requests.propose(facts.WS, facts.changeRequestOf(changes))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactIncomplete,
        })
        expect(store.byKey).not.toHaveBeenCalled()
    })
})

describe("BrainChangeRequestsService: the reason is mandatory and real (BG4)", () => {
    it.each([
        ["no reason", { reason: undefined }, "missing"],
        ["an empty reason", { reason: "   " }, "missing"],
        ["a reason too short to say why", { reason: "gia moi!" }, "missing"],
        ["a copy of the value", { value: OPENING_HOURS_VALUE_VI, reason: "mo cua luc 9 gio sang" }, "copy"],
        ["a copy of the quoted words", { reason: "From Monday we open at 9." }, "copy"],
    ])("refuses %s before anything is filed or vetted", async (_name, changes, problem) => {
        const { requests, facts: store } = await build()
        const hook = { vet: jest.fn(), filed: jest.fn() } satisfies ChangeRequestHook
        requests.whenFiled(hook)

        await expect(requests.propose(facts.WS, facts.changeRequestOf(changes))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactIncomplete,
            params: { field: "reason", problem },
        })
        expect(store.byKey).not.toHaveBeenCalled()
        expect(store.propose).not.toHaveBeenCalled()
        expect(hook.vet).not.toHaveBeenCalled()
        expect(hook.filed).not.toHaveBeenCalled()
    })

})

describe("BrainChangeRequestsService: the hook vets the words and posts the card (BG4)", () => {
    it("vets the words before filing and hands the filed request to the card after", async () => {
        const { requests, facts: store } = await build()
        const proposal = facts.factOf({ id: "p1", value: "9h", status: "proposed" })
        store.propose.mockResolvedValue({ fact: proposal, outcome: "proposed" })
        const order: Array<string> = []
        const hook: ChangeRequestHook = {
            vet: jest.fn(() => {
                order.push("vet")
                return Promise.resolve(undefined)
            }),
            filed: jest.fn(() => {
                order.push("filed")
                return Promise.resolve()
            }),
        }
        requests.whenFiled(hook)
        store.propose.mockImplementation(() => {
            order.push("store")
            return Promise.resolve({ fact: proposal, outcome: "proposed" })
        })

        const request = facts.changeRequestOf()
        await expect(requests.propose(facts.WS, request)).resolves.toEqual({ outcome: "filed", fact: proposal })
        expect(order).toEqual(["vet", "store", "filed"])
        expect(hook.filed).toHaveBeenCalledWith(facts.WS, request, { outcome: "filed", fact: proposal })
    })

    it.each([
        ["the founder's own words", "owner", "owner"],
        ["a manager's words", "manager", "manager"],
        ["a staff member's words", "staff", "staff"],
        ["words whose speaker no hook can tell", undefined, "staff"],
    ] as const)(
        "files %s under the speaker the hook read from the chat line, never auto-applied",
        async (_name, speaker, source) => {
            const { requests, facts: store } = await build()
            store.propose.mockResolvedValue({
                fact: facts.factOf({ id: "p1", status: "proposed" }),
                outcome: "proposed",
            })
            requests.whenFiled({ vet: jest.fn().mockResolvedValue(speaker), filed: jest.fn() })

            await requests.propose(facts.WS, facts.changeRequestOf())

            expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ sourceKind: source, autoApply: false })
        },
    )

})

describe("BrainChangeRequestsService: the hook's speaker and refusal (BG4)", () => {
    it("files a request to stop a value under the speaker too", async () => {
        const { requests, facts: store } = await build()
        const active = facts.factOf({ id: "f1", status: "active", value: "8h" })
        store.byKey
            .mockResolvedValueOnce([active])
            .mockResolvedValueOnce([facts.factOf({ id: "r1", status: "proposed", proposalKind: "retire" })])
        store.proposeRetire.mockResolvedValue(true)
        requests.whenFiled({ vet: jest.fn().mockResolvedValue("owner"), filed: jest.fn() })

        await requests.propose(facts.WS, facts.changeRequestOf({ value: null }))

        expect(store.proposeRetire.mock.calls[0]?.[4]).toBe("owner")
    })

    it("has no field by which the model could name the source: a request carries the message, the hook names the speaker", () => {
        const request = facts.changeRequestOf()

        expect(Object.keys(request)).not.toContain("sourceKind")
        expect(Object.keys(request)).not.toContain("source")
    })

    it("files nothing when the hook refuses the words (not a person's line of the team chat)", async () => {
        const { requests, facts: store } = await build()
        requests.whenFiled({
            vet: jest.fn().mockRejectedValue(new Error("not a person's line")),
            filed: jest.fn(),
        })

        await expect(requests.propose(facts.WS, facts.changeRequestOf())).rejects.toThrow("not a person's line")
        expect(store.propose).not.toHaveBeenCalled()
    })
})

describe("BrainChangeRequestsService: FX5, the fact a change replaces (D-P11-8)", () => {
    it("brings scheduled values whose start has come in force first, then reads the instance's key, then the workspace-wide one", async () => {
        const { requests, facts: store } = await build()
        const shared = facts.factOf({ id: "f-shared", status: "active", value: "8h", installationId: null })
        store.byKey.mockResolvedValueOnce([]).mockResolvedValueOnce([shared]).mockResolvedValueOnce([])
        store.propose.mockResolvedValue({
            fact: facts.factOf({ id: "p1", status: "proposed", conflictWith: "f-shared" }),
            outcome: "conflict",
        })

        await requests.propose(facts.WS, facts.changeRequestOf({ installationId: "inst-sales" }))

        expect(store.maintain).toHaveBeenCalledWith(facts.WS)
        expect(store.maintain.mock.invocationCallOrder[0]).toBeLessThan(store.byKey.mock.invocationCallOrder[0] ?? 0)
        expect(store.byKey.mock.calls.slice(0, 3).map((call) => [call[3], call[4]])).toEqual([
            ["active", "inst-sales"],
            ["active", null],
            ["proposed", null],
        ])
        // The next version of the workspace-wide value: its scope, so the old value is replaced instead of joined.
        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ installationId: null })
    })

    it("files under the key and scope of the fact named by id, whatever labels the agent chose", async () => {
        const { requests, facts: store } = await build()
        const named = facts.factOf({
            id: "f9",
            status: "active",
            value: "8h",
            subjectLabel: SHOP_SUBJECT_VI,
            attributeLabel: OPENING_HOURS_ATTRIBUTE_VI,
            subjectKey: "cua-hang",
            attribute: "gio-mo-cua",
        })
        store.get.mockResolvedValue(named)
        store.propose.mockResolvedValue({
            fact: facts.factOf({ id: "p1", status: "proposed", conflictWith: "f9" }),
            outcome: "conflict",
        })

        await requests.propose(facts.WS, facts.changeRequestOf({ replaces: "f9", installationId: "inst-sales" }))

        expect(store.byKey).toHaveBeenCalledTimes(1)
        expect(store.byKey).toHaveBeenCalledWith(facts.WS, "cua-hang", "gio-mo-cua", "proposed", null)
        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({
            subjectLabel: SHOP_SUBJECT_VI,
            attributeLabel: OPENING_HOURS_ATTRIBUTE_VI,
            installationId: null,
        })
    })

    it("asks the hook for a near-meaning candidate only for a new truth, and names it on the proposal (never merged)", async () => {
        const { requests, facts: store } = await build()
        const proposal = facts.factOf({ id: "p1", status: "proposed", conflictWith: null })
        const near = facts.factOf({ id: "f-near", status: "active" })
        store.propose.mockResolvedValue({ fact: proposal, outcome: "proposed" })
        store.flagSameMeaning.mockResolvedValue(true)
        store.get.mockResolvedValue({ ...proposal, conflictWith: "f-near", flags: ["same_meaning"] })
        const hook: ChangeRequestHook = { vet: jest.fn(), filed: jest.fn(), nearOf: jest.fn().mockResolvedValue(near) }
        requests.whenFiled(hook)

        const filed = await requests.propose(facts.WS, facts.changeRequestOf())

        expect(store.flagSameMeaning).toHaveBeenCalledWith(facts.WS, "p1", "f-near")
        expect(filed.fact).toMatchObject({ conflictWith: "f-near", flags: ["same_meaning"] })
        expect(store.apply).not.toHaveBeenCalled()
        expect(store.choose).not.toHaveBeenCalled()
    })
})

describe("BrainChangeRequestsService: FX6, a truth an agent proposes is the whole shop's", () => {
    it("a NEW truth relayed by an agent of one instance is filed workspace-wide (its instance only looked for a value to change)", async () => {
        const { requests, facts: store } = await build()
        store.propose.mockResolvedValue({ fact: facts.factOf({ id: "p1", status: "proposed" }), outcome: "proposed" })

        await requests.propose(facts.WS, facts.changeRequestOf({ installationId: "inst-sales" }))

        expect(store.byKey.mock.calls.map((call) => [call[3], call[4]])).toEqual([
            ["active", "inst-sales"],
            ["active", null],
            // D-BR-6: no value in force, so the plans of the key are read, in the same order.
            ["scheduled", "inst-sales"],
            ["scheduled", null],
            ["proposed", null],
        ])
        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ installationId: null, autoApply: false })
    })

    it("a change of a value kept for the caller's own instance stays the next version of THAT fact, in its scope", async () => {
        const { requests, facts: store } = await build()
        const own = facts.factOf({ id: "f-own", status: "active", value: "8h", installationId: "inst-sales" })
        store.byKey.mockResolvedValueOnce([own]).mockResolvedValueOnce([])
        store.propose.mockResolvedValue({
            fact: facts.factOf({ id: "p1", status: "proposed", conflictWith: "f-own" }),
            outcome: "conflict",
        })

        await requests.propose(facts.WS, facts.changeRequestOf({ installationId: "inst-sales" }))

        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ installationId: "inst-sales" })
    })

    it("replacedFor (the learning's door): the instance's own value, else the workspace-wide one, else nothing", async () => {
        const { requests, facts: store } = await build()
        const own = facts.factOf({ id: "f-own", status: "active", installationId: "inst-sales" })
        const shared = facts.factOf({ id: "f-shared", status: "active", installationId: null })
        const labels = { subjectLabel: "Shop", attributeLabel: "Hours" }

        store.byKey.mockResolvedValueOnce([own])
        await expect(requests.replacedFor(facts.WS, labels, "inst-sales")).resolves.toBe(own)
        store.byKey.mockResolvedValueOnce([]).mockResolvedValueOnce([shared])
        await expect(requests.replacedFor(facts.WS, labels, "inst-sales")).resolves.toBe(shared)
        await expect(requests.replacedFor(facts.WS, labels, "inst-sales")).resolves.toBeNull()
        expect(store.byKey).toHaveBeenCalledWith(facts.WS, "shop", "hours", "active", "inst-sales")
        expect(store.propose).not.toHaveBeenCalled()
    })
})
