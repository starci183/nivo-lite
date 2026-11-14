import { Test } from "@nestjs/testing"
import { rolledUpTruthsOf } from "./document-truths-rollup.policy"
import { builder } from "@starci/jest-preset"
import type { DocumentTruthsView } from "@modules/domain/brain-extractions"

const SUBJECT = Symbol("document-truths-rollup.policy")
type Subject = typeof import("./document-truths-rollup.policy")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { rolledUpTruthsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const truthsOf = builder<DocumentTruthsView>({
    state: "done",
    stage: "settle",
    note: null,
    passagesTotal: 150,
    passagesTriaged: 150,
    passagesKept: 10,
    callsDone: 3,
    callsTotal: 3,
    truthsFound: 40,
    truthsInForce: 30,
    truthsAsked: 6,
    truthsWaiting: 4,
    callsSkipped: 0,
    linesRefused: 0,
})

describe("document-truths-rollup.policy: a file cut into parts shows ONE truths state", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("sums every count over the parts; all done reads done", () => {
        expect(
            subject.rolledUpTruthsOf([
                truthsOf(),
                truthsOf({
                    passagesTotal: 50,
                    passagesTriaged: 50,
                    passagesKept: 2,
                    callsDone: 1,
                    callsTotal: 1,
                    truthsFound: 5,
                    truthsInForce: 5,
                    truthsAsked: 0,
                    truthsWaiting: 0,
                }),
            ]),
        ).toEqual({
            state: "done",
            stage: "settle",
            note: null,
            passagesTotal: 200,
            passagesTriaged: 200,
            passagesKept: 12,
            callsDone: 4,
            callsTotal: 4,
            truthsFound: 45,
            truthsInForce: 35,
            truthsAsked: 6,
            truthsWaiting: 4,
            callsSkipped: 0,
            linesRefused: 0,
            linesUnread: 0,
        })
    })
})

describe("document-truths-rollup.policy: the state, stage and note of the least advanced part", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("takes the state, stage and note of the LEAST advanced part", () => {
        const waiting = truthsOf({ state: "awaiting_critique", note: "BRAIN_NOTE_AWAITING_CRITIQUE" })
        const extracting = truthsOf({ state: "running", stage: "extract" })
        const triaging = truthsOf({ state: "running", stage: "triage" })
        const noCredits = truthsOf({
            state: "blocked_credits",
            stage: "extract",
            note: "KNOWLEDGE_NOTE_NO_CREDITS_FACTS",
        })
        const failed = truthsOf({ state: "failed", stage: "extract", note: "BRAIN_NOTE_MODEL_BUSY" })
        const lead = (parts: ReadonlyArray<DocumentTruthsView>) => {
            const rolled = subject.rolledUpTruthsOf(parts)
            return [rolled?.state, rolled?.stage, rolled?.note]
        }

        expect(lead([truthsOf(), waiting])).toEqual(["awaiting_critique", "settle", "BRAIN_NOTE_AWAITING_CRITIQUE"])
        expect(lead([waiting, truthsOf({ state: "at_ceiling" }), extracting])).toEqual(["running", "extract", null])
        expect(lead([extracting, triaging])).toEqual(["running", "triage", null])
        expect(lead([truthsOf({ state: "running", stage: "settle" }), waiting])).toEqual([
            "awaiting_critique",
            "settle",
            "BRAIN_NOTE_AWAITING_CRITIQUE",
        ])
        expect(lead([triaging, noCredits])).toEqual(["blocked_credits", "extract", "KNOWLEDGE_NOTE_NO_CREDITS_FACTS"])
        // A failed part needs the founder first.
        expect(lead([noCredits, failed, truthsOf()])).toEqual(["failed", "extract", "BRAIN_NOTE_MODEL_BUSY"])
    })

    it("a part whose truths work has not started counts as the start of triage, so the document is never done before every part is", () => {
        expect(subject.rolledUpTruthsOf([truthsOf(), null])).toMatchObject({
            state: "running",
            stage: "triage",
            truthsInForce: 30,
            passagesTotal: 150,
        })
    })

    it("no part has a truths state: null; one part is itself", () => {
        expect(subject.rolledUpTruthsOf([null, null])).toBeNull()
        expect(subject.rolledUpTruthsOf([])).toBeNull()
        expect(subject.rolledUpTruthsOf([truthsOf()])).toEqual(truthsOf())
    })
})

describe("document-truths-rollup.policy: a part read the old way", () => {
    let subject: Subject

    beforeAll(async () => {
        subject = await build()
    })

    it("a part read the old way ranks before done: the document says legacy (and offers read again) until every part is new", () => {
        const old = truthsOf({
            state: "legacy",
            stage: null,
            note: "BRAIN_NOTE_READ_OLD_WAY",
            passagesTotal: 0,
            passagesTriaged: 0,
        })
        expect(subject.rolledUpTruthsOf([truthsOf(), old])).toMatchObject({
            state: "legacy",
            note: "BRAIN_NOTE_READ_OLD_WAY",
            passagesTotal: 150,
        })
        expect(subject.rolledUpTruthsOf([old, truthsOf({ state: "at_ceiling" })])).toMatchObject({ state: "at_ceiling" })
    })
})
