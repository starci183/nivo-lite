import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock, type MockOf } from "@starci/jest-preset"
import {
    AiGenerationsError,
    AiGenerationsErrorCode,
    GenerationsService,
    type GenerationOutcome,
} from "@modules/domain/ai-generations"
import { LESSON_GROUPS_PROMPT_VERSION, LessonCandidatesService } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersReadService, type MemberRow } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, workInScope, type Logger } from "@modules/platform/logging"
import { memoryLessonsOf, type MemoryLessons } from "@tests/fixtures/builders/agent-threads.builder"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { RunStop } from "./run-stop.contracts"
import type {
    LearningChange,
    LearningChangeDoor,
    LearningChangeState,
    StopLearningPass,
} from "./stop-learning.contracts"
import { StopLearningDoorService } from "./stop-learning-door.service"
import { StopLearningLogEvent } from "./stop-learning.log-events"
import { StopLearningService } from "./stop-learning.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"
const WORKFLOW = "33333333-3333-4333-8333-333333333333"
const FOUNDER = "44444444-4444-4444-8444-444444444444"
const NOW = new Date("2026-11-11T12:00:00.000Z")
const IDS = fakeIds("5")

/** A laundry's intake step (synthetic trade): the agent stops when a garment's care label is unclear. */
const QUESTION = "The care label of this garment is unreadable, how should it be washed?"

/** The founder's answers: two say the same about wool; one is about a stain; one contradicts the wool rule. */
const WOOL_FIRST = "Wool: cold wash, never tumble dry"
const WOOL_SECOND = "same as last time, wool gets a cold wash, never tumble dry"
const STAIN = "Ink stains go to the spot-cleaning desk first"
const WOOL_HOT = "Wool can go in the hot programme now, the new machine is gentle"

/** The rule the scripted model drafts, copied verbatim from the wool answers. */
const RULE = "never tumble dry"

const stopOf = (answers: RunStop["answers"], state: RunStop["state"] = "resolved"): RunStop => ({
    id: IDS.next(),
    version: "1",
    runId: IDS.next(),
    stepKey: "intake",
    agentId: AGENT,
    workflowId: WORKFLOW,
    contactId: IDS.next(),
    conversationId: null,
    kind: "ai_report",
    state,
    reason: "Care label unreadable.",
    question: QUESTION,
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers,
    decision: answers.at(-1) ?? null,
    repeats: 1,
    stoppedAt: NOW.toISOString(),
    resolvedAt: state === "resolved" ? NOW.toISOString() : null,
})

const answerOf = (text: string, at: string): RunStop["answers"][number] => ({ kind: "answer", text, by: FOUNDER, at })

const ok = (output: string): GenerationOutcome => ({
    ok: true,
    output,
    generationId: IDS.next(),
    timings: {},
    usage: null,
})

/** An agreeing group of the scripted model's answer. */
const agreeOf = (items: ReadonlyArray<number>, restsOn: ReadonlyArray<number> = items) => ({
    items,
    answers: "agree",
    subject: "Wool garments",
    attribute: "Drying",
    topic: "how to dry wool when the label is unreadable",
    lesson: { value: RULE, unit: null, valid_to: null, rests_on: restsOn },
})

/** A contradicting group of the scripted model's answer. */
const contradictOf = (items: ReadonlyArray<number>) => ({
    items,
    answers: "contradict",
    subject: "Wool garments",
    attribute: "Wash programme",
    topic: "which programme wool goes in",
    lesson: null,
})

/** The scripted model's answer: these groups. */
const groupsOf = (...groups: ReadonlyArray<object>): string => JSON.stringify({ groups })

const FOUNDER_ROW: MemberRow = {
    id: FOUNDER,
    user_id: "u-founder",
    display_name: "Mai",
    role: "owner",
    status: "active",
}

interface World {
    readonly service: StopLearningService
    readonly store: MemoryLessons
    readonly posted: Array<LearningChange>
    readonly generate: jest.Mock<Promise<GenerationOutcome>, []>
    readonly scopes: Array<unknown>
    readonly logger: MockOf<Logger>
    readonly resolve: MockOf<KnowledgeGapsService>["resolve"]
    readonly settle: (stop: RunStop) => Promise<StopLearningPass>
    readonly states: Map<string, LearningChangeState>
}

/** The learning over a scripted model (no real call), an in-memory store and a recording change door. */
const worldOf = async (script: ReadonlyArray<string | GenerationOutcome>, available = true): Promise<World> => {
    const store = memoryLessonsOf(IDS)
    const posted: Array<LearningChange> = []
    const scopes: Array<unknown> = []
    const queue = [...script]
    const generate = jest.fn((): Promise<GenerationOutcome> => {
        scopes.push(workInScope())
        const next = queue.shift()
        if (next === undefined) throw new AiGenerationsError({ code: AiGenerationsErrorCode.EngineUnavailable })
        return Promise.resolve(typeof next === "string" ? ok(next) : next)
    })
    const stops = new Map<string, ReadonlyArray<RunStop>>()
    const states = new Map<string, LearningChangeState>()
    const logger = mock<Logger>()
    const records = mock<RunStopRecordsService>({ ofRun: (_ws, runId) => Promise.resolve(stops.get(runId) ?? []) })
    const door = mock<LearningChangeDoor>({
        available: () => available,
        post: (change) => {
            posted.push(change)
            states.set(`change-${posted.length}`, "open")
            return Promise.resolve({ changeId: `change-${posted.length}`, state: "open" })
        },
        stateOf: (_ws, changeId) => Promise.resolve(states.get(changeId) ?? "gone"),
    })
    const gaps = mock<KnowledgeGapsService>()
    gaps.resolve.mockResolvedValue(1)
    const members = mock<WorkspaceMembersReadService>()
    members.directory.mockResolvedValue([FOUNDER_ROW])
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopLearningService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: RunStopRecordsService, useValue: records },
            { provide: LessonCandidatesService, useValue: mock<LessonCandidatesService>(store.methods) },
            { provide: GenerationsService, useValue: mock<GenerationsService>({ generate }) },
            { provide: StopLearningDoorService, useValue: door },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: WorkspaceMembersReadService, useValue: members },
        ],
    }).compile()
    const service = moduleRef.get(StopLearningService)
    const settle = (stop: RunStop): Promise<StopLearningPass> => {
        stops.set(stop.runId, [stop])
        return service.settled({ workspaceId: WS, runId: stop.runId })
    }
    return { service, store, posted, generate, scopes, logger, resolve: gaps.resolve, settle, states }
}

/** Settles one stop per answer, in order, one day apart. */
const answered = async (world: World, said: ReadonlyArray<string>): Promise<ReadonlyArray<StopLearningPass>> => {
    const passes: Array<StopLearningPass> = []
    for (const [index, text] of said.entries()) {
        const at = new Date(Date.UTC(2026, 10, 7 + index, 9)).toISOString()
        passes.push(await world.settle(stopOf([answerOf(text, at)])))
    }
    return passes
}

describe("StopLearningService settled: what is kept", () => {
    it("one answer is a candidate only: below the threshold (a count) no model call is made", async () => {
        const world = await worldOf([])

        await expect(answered(world, [WOOL_FIRST])).resolves.toEqual([{ kept: 1, posted: 0 }])
        expect(world.generate).not.toHaveBeenCalled()
        expect(world.store.rows).toEqual([expect.objectContaining({ status: "candidate", thenDid: "completed" })])
    })

    it("the engine's own text (a tool id) is no person's answer and is not kept", async () => {
        const world = await worldOf([])

        await expect(answered(world, ["refused by nivo.tool.payment.transfer.create"])).resolves.toEqual([
            { kept: 0, posted: 0 },
        ])
        expect(world.store.rows).toEqual([])
    })

    it("keeps an answer once, skips a stop still applying its answer, and learns nothing from an AI error stop", async () => {
        const world = await worldOf([])
        const stop = stopOf([answerOf(WOOL_FIRST, "2026-11-07T09:00:00.000Z")])
        await world.settle(stop)

        await expect(world.settle(stop)).resolves.toEqual({ kept: 0, posted: 0 })
        await expect(world.settle(stopOf([answerOf(STAIN, "2026-11-08T09:00:00.000Z")], "open"))).resolves.toEqual({
            kept: 0,
            posted: 0,
        })
        await expect(
            world.settle({ ...stopOf([answerOf(STAIN, "2026-11-09T09:00:00.000Z")]), kind: "ai_error" }),
        ).resolves.toEqual({ kept: 0, posted: 0 })
        expect(world.generate).not.toHaveBeenCalled()
    })

    it("masks a phone number in the person's words and keeps no customer id", async () => {
        const world = await worldOf([])
        await answered(world, ["Call the owner at 0901 234 567 first"])

        expect(world.store.rows[0]?.answer).toBe("Call the owner at … first")
        expect(Object.keys(world.store.rows[0] ?? {})).not.toContain("leadId")
    })

    it("nothing is asked of a model, nor posted, while the change door is unavailable", async () => {
        const world = await worldOf([groupsOf(agreeOf([1, 2]))], false)
        await answered(world, [WOOL_FIRST, WOOL_SECOND])

        expect(world.generate).not.toHaveBeenCalled()
        expect(world.posted).toEqual([])
        expect(world.store.rows.map((row) => row.status)).toEqual(["candidate", "candidate"])
    })
})

describe("StopLearningService settled: the groups the model reads", () => {
    it("one call per new answer once the threshold is reached, booked to that answer; agree -> one card on its answers", async () => {
        const world = await worldOf([groupsOf(agreeOf([1, 2]))])

        await expect(answered(world, [WOOL_FIRST, WOOL_SECOND])).resolves.toEqual([
            { kept: 1, posted: 0 },
            { kept: 1, posted: 1 },
        ])
        expect(world.generate).toHaveBeenCalledTimes(1)
        expect(world.scopes).toEqual([
            expect.objectContaining({ kind: "learning", ref: `lesson:${world.store.rows.at(-1)?.id ?? ""}` }),
        ])
        expect(world.posted).toEqual([
            expect.objectContaining({
                workspaceId: WS,
                agentId: AGENT,
                origin: "learning",
                factKey: { subjectLabel: "Wool garments", attributeLabel: "Drying" },
                newValue: RULE,
                unit: null,
                oldValue: null,
            }),
        ])
        expect(world.posted[0]?.evidence).toEqual([
            expect.objectContaining({ kind: "answer", quote: WOOL_FIRST, by: { name: "Mai", memberId: "u-founder" } }),
            expect.objectContaining({ kind: "answer", quote: WOOL_SECOND }),
        ])
        expect(world.posted[0]?.evidence[0]?.ref).toMatch(/^run:.+\/step:intake$/u)
        expect(world.store.rows.every((row) => row.status === "proposed" && row.changeId === "change-1")).toBe(true)
        expect(world.logger.info).toHaveBeenCalledWith(
            StopLearningLogEvent.CardPosted,
            expect.objectContaining({ prompt: LESSON_GROUPS_PROMPT_VERSION, kind: "draft", candidates: 2 }),
        )
    })

    it("the card stands on exactly the answers the truth rests on; an answer the model left out stays free", async () => {
        const world = await worldOf([groupsOf(), groupsOf(agreeOf([1, 3]))])
        await answered(world, [WOOL_FIRST, STAIN, WOOL_SECOND])

        expect(world.generate).toHaveBeenCalledTimes(2)
        expect(world.posted.map((card) => card.evidence.map((one) => one.quote))).toEqual([[WOOL_FIRST, WOOL_SECOND]])
        expect(world.store.rows.map((row) => row.status)).toEqual(["proposed", "candidate", "proposed"])
    })

    it("contradict -> a question card on exactly those answers, the newest put forward verbatim", async () => {
        const world = await worldOf([groupsOf(contradictOf([1, 2]))])
        await answered(world, [WOOL_FIRST, WOOL_HOT])

        expect(world.posted).toEqual([
            expect.objectContaining({
                newValue: WOOL_HOT,
                unit: null,
                validity: null,
                factKey: { subjectLabel: "Wool garments", attributeLabel: "Wash programme" },
            }),
        ])
        expect(world.posted[0]?.evidence.map((one) => one.quote)).toEqual([WOOL_FIRST, WOOL_HOT])
        expect(world.logger.info).toHaveBeenCalledWith(
            StopLearningLogEvent.CardPosted,
            expect.objectContaining({ kind: "contradiction" }),
        )
    })
})

describe("StopLearningService settled: integrity and tries", () => {
    it("a dropped group is logged with GroupDropped (numbers and why, never words); the standing group still posts", async () => {
        const world = await worldOf([groupsOf(agreeOf([1, 2]), agreeOf([3, 9]))])
        await answered(world, [WOOL_FIRST, WOOL_SECOND])

        expect(world.posted).toHaveLength(1)
        expect(world.logger.warn).toHaveBeenCalledWith(StopLearningLogEvent.GroupDropped, {
            candidate: world.store.rows.at(-1)?.id,
            numbers: [3, 9],
            why: "unknown_item",
            prompt: LESSON_GROUPS_PROMPT_VERSION,
        })
    })

    it("non-JSON and an answer whose every group is dropped are failed tries: asked again within the three tries", async () => {
        const world = await worldOf(["not json", groupsOf(agreeOf([1, 2], [1])), groupsOf(agreeOf([1, 2]))])
        await answered(world, [WOOL_FIRST, WOOL_SECOND])

        expect(world.generate).toHaveBeenCalledTimes(3)
        expect(world.posted).toHaveLength(1)
        expect(world.logger.warn).toHaveBeenCalledWith(
            StopLearningLogEvent.GroupDropped,
            expect.objectContaining({ why: "too_few_answers" }),
        )
    })

    it("three failed tries post nothing, log DraftFailed and leave the candidates free", async () => {
        const failed: GenerationOutcome = { ok: false, reason: "timeout", message: "busy" }
        const invented = groupsOf({
            ...agreeOf([1, 2]),
            lesson: { ...agreeOf([1, 2]).lesson, value: "iron on high heat" },
        })
        const world = await worldOf([failed, "not json", invented])
        await answered(world, [WOOL_FIRST, WOOL_SECOND])

        expect(world.generate).toHaveBeenCalledTimes(3)
        expect(world.posted).toEqual([])
        expect(world.store.rows.map((row) => row.status)).toEqual(["candidate", "candidate"])
        expect(world.logger.warn).toHaveBeenCalledWith(StopLearningLogEvent.DraftFailed, {
            candidate: world.store.rows.at(-1)?.id,
            prompt: LESSON_GROUPS_PROMPT_VERSION,
        })
    })

    it("no groups at all is an answer, not a failed try: one call, no card, NoRule logged", async () => {
        const world = await worldOf([groupsOf()])
        await answered(world, [WOOL_FIRST, STAIN])

        expect(world.generate).toHaveBeenCalledTimes(1)
        expect(world.posted).toEqual([])
        expect(world.logger.info).toHaveBeenCalledWith(
            StopLearningLogEvent.NoRule,
            expect.objectContaining({ prompt: LESSON_GROUPS_PROMPT_VERSION }),
        )
    })
})

describe("StopLearningService reconcile: the founder's decision on the card", () => {
    it("approve: the answers are learned with the truth in force, and the gaps close on the truth's labels", async () => {
        const world = await worldOf([groupsOf(agreeOf([1, 2]))])
        await answered(world, [WOOL_FIRST, WOOL_SECOND])

        await expect(world.service.reconcile(WS)).resolves.toBe(0)
        world.states.set("change-1", "applied")
        await expect(world.service.reconcile(WS)).resolves.toBe(1)

        expect(world.store.rows.map((row) => [row.status, row.factId])).toEqual([
            ["learned", "change-1"],
            ["learned", "change-1"],
        ])
        expect(world.resolve).toHaveBeenCalledWith(WS, {
            subject: "Wool garments",
            attribute: "Drying",
            module: null,
            by: "fact:change-1",
        })
    })

    it("reject, then the model groups new answers with a turned-down one: they are declined, no new card", async () => {
        const world = await worldOf([groupsOf(agreeOf([1, 2])), groupsOf(agreeOf([1, 2, 3, 4]))])
        await answered(world, [WOOL_FIRST, WOOL_SECOND])
        world.states.set("change-1", "rejected")
        await world.service.reconcile(WS)

        await answered(world, [WOOL_SECOND, WOOL_FIRST])

        expect(world.generate).toHaveBeenCalledTimes(2)
        expect(world.posted).toHaveLength(1)
        expect(world.store.rows.map((row) => row.status)).toEqual(["declined", "declined", "declined", "declined"])
    })

    it("an answer grouped with one on an open card waits: the founder decides that card first", async () => {
        const world = await worldOf([groupsOf(agreeOf([1, 2])), groupsOf(agreeOf([1, 2, 3, 4]))])
        await answered(world, [WOOL_FIRST, WOOL_SECOND, WOOL_SECOND, WOOL_FIRST])

        expect(world.posted).toHaveLength(1)
        expect(world.store.rows.map((row) => row.status)).toEqual(["proposed", "proposed", "candidate", "candidate"])
    })
})
