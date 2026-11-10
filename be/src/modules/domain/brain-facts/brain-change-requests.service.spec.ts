import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { BrainChangeRequestsService, changeEvidenceOf } from "./brain-change-requests.service"
import type { ChangeRequest } from "./brain-facts.contracts"
import { BrainFactsService } from "./brain-facts.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"

const MESSAGE = "44444444-4444-4444-8444-444444444444"

const requestOf = (changes: Partial<ChangeRequest> = {}): ChangeRequest => ({
    subjectLabel: "Shop",
    attributeLabel: "Hours",
    value: "9h",
    room: "direct",
    messageId: MESSAGE,
    quote: "  from Monday we open at 9  ",
    proposedBy: "sales",
    agentId: "a1",
    installationId: null,
    ...changes,
})

const build = async () => {
    const service = mock<BrainFactsService>()
    service.byKey.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainChangeRequestsService,
            { provide: BrainFactsService, useValue: service },
            { provide: CLOCK, useValue: new FakeClock(facts.AT) },
        ],
    }).compile()
    return { requests: moduleRef.get(BrainChangeRequestsService), facts: service }
}

describe("BrainChangeRequestsService: brain.change.propose files a proposal and never activates", () => {
    it("files a new value as a proposal on the review path, with the chat message as its evidence", async () => {
        const { requests, facts: store } = await build()
        const proposal = facts.factOf({ id: "p1", value: "9h", status: "proposed", conflictWith: "f1" })
        store.byKey.mockResolvedValueOnce([facts.factOf({ id: "f1", status: "active", value: "8h" })])
        store.propose.mockResolvedValue({ fact: proposal, outcome: "conflict" })

        await expect(requests.propose(facts.WS, requestOf({ validTo: "2026-10-19T00:00:00.000Z" }))).resolves.toEqual({
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
            evidence: [
                {
                    kind: "message",
                    ref: `team-chat:${MESSAGE}`,
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

    it("never takes the direct path, even for words the owner said in the common chat", async () => {
        const { requests, facts: store } = await build()
        store.propose.mockResolvedValue({ fact: facts.factOf({ status: "proposed" }), outcome: "proposed" })

        await requests.propose(facts.WS, requestOf({ room: "common" }))

        expect(store.propose.mock.calls[0]?.[1]).toMatchObject({ autoApply: false, sourceKind: "staff" })
        expect(store.apply).not.toHaveBeenCalled()
    })

})

describe("BrainChangeRequestsService: the same value, a retire request, an incomplete request", () => {
    it("files nothing when the value in force already says it", async () => {
        const { requests, facts: store } = await build()
        const active = facts.factOf({ id: "f1", status: "active", value: "9H" })
        store.byKey.mockResolvedValueOnce([active])

        await expect(requests.propose(facts.WS, requestOf())).resolves.toEqual({ outcome: "already_true", fact: active })
        expect(store.propose).not.toHaveBeenCalled()
    })

    it("answers already_filed when the same value already waits (the message is added to that proposal)", async () => {
        const { requests, facts: store } = await build()
        const waiting = facts.factOf({ id: "p0", status: "proposed", value: "9h" })
        store.byKey.mockResolvedValueOnce([]).mockResolvedValueOnce([waiting])
        store.propose.mockResolvedValue({ fact: waiting, outcome: "proposed" })

        await expect(requests.propose(facts.WS, requestOf())).resolves.toEqual({ outcome: "already_filed", fact: waiting })
    })

    it("files a proposal to stop using the value in force for a request with no value", async () => {
        const { requests, facts: store } = await build()
        const active = facts.factOf({ id: "f1", status: "active" })
        const retire = facts.factOf({ id: "r1", status: "proposed", proposalKind: "retire" })
        store.byKey.mockResolvedValueOnce([active]).mockResolvedValueOnce([retire])
        store.proposeRetire.mockResolvedValue(true)

        await expect(requests.propose(facts.WS, requestOf({ value: null }))).resolves.toEqual({ outcome: "filed", fact: retire })
        expect(store.proposeRetire).toHaveBeenCalledWith(
            facts.WS,
            active,
            changeEvidenceOf(requestOf(), facts.AT),
            "sales",
            "staff",
        )
        expect(store.apply).not.toHaveBeenCalled()
    })

    it("refuses to retire when nothing is in force", async () => {
        const { requests } = await build()

        await expect(requests.propose(facts.WS, requestOf({ value: null }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.NotActive,
        })
    })

    it.each([
        ["an empty subject", { subjectLabel: "  " }],
        ["an empty quote", { quote: "   " }],
    ])("refuses %s before reading anything", async (_name, changes) => {
        const { requests, facts: store } = await build()

        await expect(requests.propose(facts.WS, requestOf(changes))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactIncomplete,
        })
        expect(store.byKey).not.toHaveBeenCalled()
    })
})
