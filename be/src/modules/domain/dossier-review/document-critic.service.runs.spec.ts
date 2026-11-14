import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import {
    answered,
    buildCriticSubject,
    ownTruthOf,
    rowOf,
    sectionsOf,
    type OwnTruth,
    type Subject,
} from "@tests/fixtures/builders/dossier-review-critic.builder"
import { NOW, SRC, WS, type Row } from "@tests/fixtures/builders/dossier-review-world.builder"
import { CRITIC_CAPS, isGivenUp, runsAfter, takesAnotherTurn, type CritiqueRunEnd } from "./document-critic.contracts"
import type { CritiqueTry } from "./document-critic.port"
import { DossierReviewError, DossierReviewErrorCode } from "./errors/dossier-review.error"
import { SourceCritiqueEntity } from "./persistence/entities"

/**
 * THE COUNT OF RUNS of a document's critique (D-V-1: a critique that never progressed was asked again by every upkeep tick, its
 * count reset by each request and claim) and the TURNS of a workspace's documents (D-V-3: one endless critique held the others),
 * through the REAL `DocumentCriticService` on the in-memory world, with a scripted model. The only progress of a run is a passage
 * newly reviewed by the security read (the per-truth verification is deleted). Synthetic data of another trade: the service rules
 * of a bicycle repair workshop.
 */

/** The workshop's service rules: three sections, one passage each. */
const WORKSHOP = [
    "# Puncture repair\n\nA puncture on a standard inner tube is repaired for 60,000 VND while the customer waits.",
    "# Brake service\n\nA full brake service, pads and cables included, costs 250,000 VND and takes one working day.",
    "# Storage\n\nA bicycle left more than 30 days after the repair is ready is charged 20,000 VND per day of storage.",
].join("\n\n")

/** The workshop document's title. */
const TITLE = "Workshop service rules"

/** Its waiting truths, as the reading filed them. */
const TRUTHS: ReadonlyArray<OwnTruth> = [
    { id: "t-puncture", subjectLabel: "Puncture repair", attributeLabel: "Price", value: "60,000 VND", quote: "repaired for 60,000 VND" },
    { id: "t-brakes", subjectLabel: "Brake service", attributeLabel: "Price", value: "250,000 VND", quote: "costs 250,000 VND" },
    { id: "t-storage", subjectLabel: "Storage", attributeLabel: "Daily fee", value: "20,000 VND", quote: "20,000 VND per day of storage" },
]

/** A critic try the model never answered (a provider failure: no call paid). */
const down = (): CritiqueTry => ({ ok: false, reason: "unavailable" })

/** A critic try that answered something that is not the JSON asked for (a paid call). */
const unreadable = (): CritiqueTry => ({ ok: false, reason: "unreadable" })

/** A critic try whose answer was cut at the token cap (a paid call): the next try reads half the passages. */
const cut = (): CritiqueTry => ({ ok: false, reason: "cut" })

/** The workshop document uploaded and read, its critique asked for: no passage reviewed yet. */
const workshop = async (): Promise<Subject> => {
    const subject = await buildCriticSubject()
    subject.world.upload(WORKSHOP)
    subject.world.facts = TRUTHS.map((truth) => ownTruthOf(subject.world, truth, TITLE))
    await subject.critic.request(WS, SRC)
    return subject
}

/** One upkeep tick that goes on with the critique (a RESUME), then the review run that carries out what waits. */
const tick = async (subject: Subject): Promise<boolean> => {
    const waits = await subject.critic.request(WS, SRC, { resume: true })
    await subject.critic.runWaiting(WS)
    return waits
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe("the count of runs of a critique (CRITIC_CAPS.runs; D-V-1)", () => {
    const end = (changes: Partial<CritiqueRunEnd>): CritiqueRunEnd => ({
        state: "not_done",
        reason: "model",
        progressed: false,
        exhausted: false,
        ...changes,
    })

    it("counts only the runs that ended not done without progress; done and progress start it again; credits keep it; a model failure with nothing left to read is given up at once", () => {
        expect(CRITIC_CAPS.runs).toBe(3)
        expect(runsAfter(0, end({}))).toBe(1)
        expect(runsAfter(2, end({ reason: "budget" }))).toBe(3)
        expect(runsAfter(3, end({}))).toBe(3)
        expect(runsAfter(2, end({ progressed: true }))).toBe(0)
        expect(runsAfter(2, end({ state: "done", reason: null }))).toBe(0)
        expect(runsAfter(2, end({ reason: "credits" }))).toBe(2)
        expect(runsAfter(1, end({ reason: "facts_unread" }))).toBe(1)
        expect(runsAfter(0, end({ exhausted: true, progressed: true }))).toBe(3)
        // Never outside the table's check (0..3), whatever the row held.
        expect(runsAfter(9, end({ reason: "credits" }))).toBe(3)
        expect(runsAfter(-1, end({ reason: "credits" }))).toBe(0)
    })

    it("a slice takes another turn only with progress and more to do; given up is not done at the bound", () => {
        expect(takesAnotherTurn(end({ reason: "budget", progressed: true }))).toBe(true)
        expect(takesAnotherTurn(end({ reason: "budget" }))).toBe(false)
        expect(takesAnotherTurn(end({ reason: "model", progressed: true }))).toBe(false)
        expect(isGivenUp({ state: "not_done", attempts: 3 })).toBe(true)
        expect(isGivenUp({ state: "not_done", attempts: 2 })).toBe(false)
        expect(isGivenUp({ state: "waiting", attempts: 3 })).toBe(false)
    })
})

describe("DocumentCriticService: a critique that never progresses is run at most CRITIC_CAPS.runs times (D-V-1)", () => {
    it("a dead model: runs 1, 2, 3 count 1, 2, 3 across resumes and claims; then no tick asks again and no call is made; a new request starts the count again", async () => {
        const subject = await workshop()
        // What the row says WHILE each run is running: the count survived the resume and the claim.
        const seen: Array<unknown> = []
        subject.model.critique.mockImplementation(() => {
            seen.push([rowOf(subject).state, rowOf(subject).attempts])
            return Promise.resolve(down())
        })

        await subject.critic.runWaiting(WS)
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: 1 })
        await expect(tick(subject)).resolves.toBe(true)
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: 2 })
        await expect(tick(subject)).resolves.toBe(true)
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: 3 })
        expect(await subject.critic.givenUp(WS, SRC)).toBe(true)
        const calls = subject.model.critique.mock.calls.length
        expect(new Set(seen.map((one) => JSON.stringify(one)))).toEqual(
            new Set([JSON.stringify(["running", 0]), JSON.stringify(["running", 1]), JSON.stringify(["running", 2])]),
        )

        // Given up: however many ticks pass, nothing waits and nothing is asked.
        await expect(tick(subject)).resolves.toBe(false)
        await expect(tick(subject)).resolves.toBe(false)
        expect(subject.model.critique).toHaveBeenCalledTimes(calls)
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: 3 })

        // A NEW request (the reading ended again, a person's "read again") starts the count again.
        await expect(subject.critic.request(WS, SRC)).resolves.toBe(true)
        expect(rowOf(subject)).toMatchObject({ state: "waiting", attempts: 0 })
        expect(await subject.critic.givenUp(WS, SRC)).toBe(false)
    })

    it("a run that throws counts like any run without progress, and still tells the truths work it ended", async () => {
        const subject = await workshop()
        subject.model.critique.mockRejectedValue(new DossierReviewError({ code: DossierReviewErrorCode.CriticNotFound }))

        await subject.critic.runWaiting(WS)
        await tick(subject)
        await tick(subject)

        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: 3 })
        expect(subject.hook.critiqued).toHaveBeenCalledTimes(3)
        await expect(tick(subject)).resolves.toBe(false)
    })
})

describe("DocumentCriticService: what moves the count of runs, and what keeps it (D-V-1)", () => {
    it("a run that newly reviewed a passage starts the count again: only runs in a ROW without progress give a critique up", async () => {
        const subject = await workshop()

        await subject.critic.runWaiting(WS)
        await tick(subject)
        expect(rowOf(subject)).toMatchObject({ attempts: 2 })
        // The third run: its first try is cut, the try over half the passages answers (one passage reviewed), the rest fails.
        subject.script.push(cut, () => answered([]))
        await tick(subject)
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: 0 })
        expect(rowOf(subject).reviewedHashes).toHaveLength(1)
        await tick(subject)
        expect(rowOf(subject)).toMatchObject({ attempts: 1 })
    })

    it("the empty credit pool keeps the count (no call was made): it never gives a critique up by itself", async () => {
        const subject = await workshop()

        await subject.critic.runWaiting(WS)
        subject.usage.blockedBy.mockResolvedValue(true)
        const calls = subject.model.critique.mock.calls.length
        await tick(subject)
        await tick(subject)
        await tick(subject)

        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "credits", attempts: 1 })
        expect(subject.model.critique).toHaveBeenCalledTimes(calls)
    })

    it("a critique whose worker went silent is taken back by a resume only after 15 minutes, counted as a run without progress", async () => {
        const subject = await workshop()
        Object.assign(rowOf(subject), { state: "running", attempts: 1, startedAt: new Date(NOW.getTime() - 5 * 60_000) })
        await expect(subject.critic.request(WS, SRC, { resume: true })).resolves.toBe(false)
        expect(rowOf(subject)).toMatchObject({ state: "running", attempts: 1 })

        rowOf(subject).startedAt = new Date(NOW.getTime() - 20 * 60_000)
        await expect(subject.critic.request(WS, SRC, { resume: true })).resolves.toBe(true)
        expect(rowOf(subject)).toMatchObject({ state: "waiting", reason: null, attempts: 2 })

        // A done critique, or one waiting already, is no resume's to move.
        rowOf(subject).state = "done"
        await expect(subject.critic.request(WS, SRC, { resume: true })).resolves.toBe(false)
        expect(rowOf(subject)).toMatchObject({ state: "done", attempts: 2 })
    })
})

describe("DocumentCriticService: given up is visible and final for the machine, and holds no truth (D-V-1; owner 2026-11-12)", () => {
    it("a model that answers every call with nothing readable is given up within CRITIC_CAPS.runs runs of two paid calls; its passages stay withheld from customers; no truth waits for it; the truths work is told every end", async () => {
        const subject = await workshop()
        subject.model.critique.mockImplementation(() => Promise.resolve(unreadable()))

        await subject.critic.runWaiting(WS)
        const ticks = { made: 0 }
        while (ticks.made < 10) {
            await tick(subject)
            ticks.made += 1
        }

        expect(await subject.critic.givenUp(WS, SRC)).toBe(true)
        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: CRITIC_CAPS.runs })
        // One told retry per run, then the tries end: two paid calls a run, for the whole life of the document.
        expect(subject.model.critique).toHaveBeenCalledTimes(CRITIC_CAPS.runs * 2)
        // Unreviewed passages are not served to customers ...
        expect(subject.world.chunks.every((chunk) => !chunk.customerReady)).toBe(true)
        // ... but nothing of the truths waits on the critique: no point holds them, the critic never changes them.
        const gate = await subject.critic.truthGateOf(WS, SRC)
        expect(gate).toMatchObject({ state: "not_done", unverifiedTruths: 0 })
        expect(gate.held.size).toBe(0)
        expect(gate.findings.filter((one) => one.holds)).toEqual([])
        expect(subject.world.facts.map((fact) => fact.status)).toEqual(["proposed", "proposed", "proposed"])
        expect(subject.hook.critiqued).toHaveBeenCalledTimes(CRITIC_CAPS.runs)
        expect(subject.hook.critiqued.mock.calls.every(([ws, source]) => ws === WS && source === SRC)).toBe(true)
    })
})

describe("DocumentCriticService: one long critique gives the turn to the workspace's other documents (D-V-3)", () => {
    const OTHER = "55555555-5555-4555-8555-555555555555"
    const LATE = "66666666-6666-4666-8666-666666666666"
    /** More passages than `callsPerCritique` calls of `changedChars` read: the first run ends a slice (`budget`) with progress. */
    const LONG = sectionsOf(1_000)

    /**
     * The in-memory table in the order the service reads it (`requestedAt` ascending; the world itself answers rows in insertion
     * order, so the spec sorts them as the table read does).
     */
    const ordered = (subject: Subject): void => {
        const at = (row: Row): number => (row.requestedAt instanceof Date ? row.requestedAt.getTime() : 0)
        subject.world.critiques.sort((left, right) => at(left) - at(right))
    }

    it("a slice that made progress (`budget`) waits again at the BACK, its count 0; the documents that waited before it run first; it comes back after them", async () => {
        const subject = await buildCriticSubject()
        subject.world.upload(LONG)
        await subject.critic.request(WS, SRC)
        subject.model.critique.mockImplementation(() => Promise.resolve(answered([])))
        const waitingRow = (sourceId: string, minutesAgo: number): Row => ({
            id: `q-${sourceId}`,
            workspaceId: WS,
            sourceId,
            state: "waiting",
            reason: null,
            attempts: 0,
            reviewedHashes: subject.world.chunks.map((chunk) => passageTextHashOf(chunk.content)),
            verifiedTruths: [],
            modelCalls: 0,
            promptTokens: 0,
            requestedAt: new Date(NOW.getTime() - minutesAgo * 60_000),
            startedAt: null,
        })
        rowOf(subject).requestedAt = new Date(NOW.getTime() - 120 * 60_000)
        subject.world.critiques.push(waitingRow(OTHER, 60))
        ordered(subject)
        const order: Array<string> = []
        const real = subject.critic.critique.bind(subject.critic)
        jest.spyOn(subject.critic, "critique").mockImplementation((workspaceId, sourceId) => {
            order.push(sourceId)
            return real(workspaceId, sourceId)
        })

        await expect(subject.critic.runWaiting(WS)).resolves.toBe(2)
        // The slice made `callsPerCritique` calls and waits again, asked NOW (behind everything that waited), no reason, count 0.
        expect(subject.model.critique).toHaveBeenCalledTimes(CRITIC_CAPS.callsPerCritique)
        expect(rowOf(subject)).toMatchObject({ state: "waiting", reason: null, attempts: 0, requestedAt: NOW })
        expect(await subject.critic.hasWaiting(WS)).toBe(true)
        // A document asked for meanwhile, before the slice's end, runs before the slice comes back.
        subject.world.critiques.push(waitingRow(LATE, 1))
        ordered(subject)

        await subject.critic.runWaiting(WS)

        expect(order).toEqual([SRC, OTHER, LATE, SRC])
        // Both batches read the waiting critiques the longest-waiting first, at most `perRun` of them.
        expect(subject.world.em.find).toHaveBeenCalledWith(
            SourceCritiqueEntity,
            expect.objectContaining({ where: { workspaceId: WS, state: "waiting" }, order: { requestedAt: "ASC" }, take: CRITIC_CAPS.perRun }),
        )
        expect(rowOf(subject)).toMatchObject({ state: "done", reason: null, attempts: 0, waitingPassages: 0 })
        expect(await subject.critic.hasWaiting(WS)).toBe(false)
    })

    it("a critique that ended without progress is NOT waiting: the workspace has nothing to follow up (no tight loop)", async () => {
        const subject = await workshop()

        await expect(subject.critic.runWaiting(WS)).resolves.toBe(1)

        expect(rowOf(subject)).toMatchObject({ state: "not_done", reason: "model", attempts: 1 })
        expect(await subject.critic.hasWaiting(WS)).toBe(false)
    })
})
