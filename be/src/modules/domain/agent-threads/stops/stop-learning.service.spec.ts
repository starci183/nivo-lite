import { randomUUID } from "node:crypto"
import { workInScope } from "@modules/platform/logging"
import type { GenerationOutcome, GenerationsService } from "@modules/domain/ai-generations"
import { groupOf, lessonWordsOf, maskedOf } from "@modules/domain/brain-lessons"
import type {
    LessonCandidate,
    LessonCandidateInput,
    LessonCandidateKept,
    LessonCandidatesService,
    LessonFactKey,
} from "@modules/domain/brain-lessons"
import { factSlugOf } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { searchFacts } from "@modules/domain/brain-facts/fact-view.policy"
import type { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import type { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { Logger } from "@modules/platform/logging"
import type { RunStopRecordsService } from "./run-stop-records.service"
import type { RunStop } from "./run-stop.contracts"
import type { LearningChange, LearningChangeDoor } from "./stop-learning.contracts"
import { StopLearningService } from "./stop-learning.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"
const WORKFLOW = "33333333-3333-4333-8333-333333333333"
const FOUNDER = "44444444-4444-4444-8444-444444444444"
const NOW = new Date("2026-11-11T12:00:00.000Z")

/** The wrong-code transfer the agent cannot settle alone (DESIGN "WRONG CODE, RIGHT AMOUNT"), with a code that differs each time. */
const wrongCodeStop = (code: string, answers: RunStop["answers"], state: RunStop["state"] = "resolved"): RunStop => ({
    id: randomUUID(),
    version: "1",
    runId: randomUUID(),
    stepKey: "match",
    agentId: AGENT,
    workflowId: WORKFLOW,
    leadId: randomUUID(),
    conversationId: null,
    kind: "ai_report",
    state,
    reason: `Chuyển khoản 3.000 ₫ với mã ${code} không khớp đơn nào đang mở; số tiền bằng đúng đơn đang chờ.`,
    question: "Có ghi nhận chuyển khoản sai mã này cho đơn đang chờ không?",
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

/** The lesson store, in memory, with the real grouping and masking policies. */
class MemoryCandidates {
    readonly rows: Array<{ -readonly [Key in keyof LessonCandidate]: LessonCandidate[Key] }> = []

    keptOf(_ws: string, stopId: string): Promise<ReadonlySet<string>> {
        return Promise.resolve(new Set(this.rows.filter((row) => row.stopId === stopId).map((row) => row.answeredAt)))
    }

    recent(
        _ws: string,
        place: { agentId: string; stepKey: string; workflowId: string | null },
        since: Date,
    ): Promise<ReadonlyArray<LessonCandidate>> {
        return Promise.resolve(
            this.rows
                .filter(
                    (row) =>
                        row.agentId === place.agentId &&
                        row.stepKey === place.stepKey &&
                        row.workflowId === place.workflowId &&
                        row.answeredAt >= since.toISOString(),
                )
                .toSorted((left, right) => right.answeredAt.localeCompare(left.answeredAt)),
        )
    }

    async keep(ws: string, input: LessonCandidateInput, since: Date): Promise<LessonCandidateKept> {
        const existing = this.rows.find((row) => row.stopId === input.stopId && row.answeredAt === input.answeredAt)
        if (existing !== undefined) return { candidate: existing, isNew: false }
        const question = maskedOf(input.question, 600)
        const keywords = lessonWordsOf(question)
        const groupId = groupOf(await this.recent(ws, input, since), keywords) ?? randomUUID()
        const row = {
            ...input,
            id: randomUUID(),
            question,
            keywords,
            answer: maskedOf(input.answer, 1000),
            general: null,
            groupId,
            status: "candidate" as const,
            changeId: null,
            factKey: null,
            factId: null,
        }
        this.rows.push(row)
        return { candidate: row, isNew: true }
    }

    judged(_ws: string, id: string, general: boolean): Promise<void> {
        this.each(
            [id],
            () => true,
            (row) => (row.general = general),
        )
        return Promise.resolve()
    }

    claim(_ws: string, ids: ReadonlyArray<string>): Promise<boolean> {
        const free = this.rows.filter((row) => ids.includes(row.id) && row.status === "candidate")
        if (free.length !== ids.length) return Promise.resolve(false)
        free.forEach((row) => (row.status = "proposing"))
        return Promise.resolve(true)
    }

    release(_ws: string, ids: ReadonlyArray<string>): Promise<void> {
        this.each(
            ids,
            (row) => row.status === "proposing",
            (row) => (row.status = "candidate"),
        )
        return Promise.resolve()
    }

    proposed(_ws: string, ids: ReadonlyArray<string>, changeId: string, key: LessonFactKey): Promise<void> {
        this.each(
            ids,
            (row) => row.status === "proposing" || row.status === "candidate",
            (row) => Object.assign(row, { status: "proposed", changeId, factKey: key }),
        )
        return Promise.resolve()
    }

    declined(_ws: string, ids: ReadonlyArray<string>): Promise<void> {
        this.each(
            ids,
            (row) => row.status === "candidate",
            (row) => (row.status = "declined"),
        )
        return Promise.resolve()
    }

    openOfKey(_ws: string, key: LessonFactKey): Promise<string | null> {
        const slug = `${factSlugOf(key.subjectLabel)}|${factSlugOf(key.attributeLabel)}`
        const open = this.rows.find(
            (row) =>
                row.status === "proposed" &&
                row.factKey !== null &&
                `${factSlugOf(row.factKey.subjectLabel)}|${factSlugOf(row.factKey.attributeLabel)}` === slug,
        )
        return Promise.resolve(open?.changeId ?? null)
    }

    openChanges(): Promise<ReadonlyArray<string>> {
        return Promise.resolve([
            ...new Set(
                this.rows.flatMap((row) => (row.status === "proposed" && row.changeId !== null ? [row.changeId] : [])),
            ),
        ])
    }

    ofChange(_ws: string, changeId: string): Promise<ReadonlyArray<LessonCandidate>> {
        return Promise.resolve(this.rows.filter((row) => row.changeId === changeId))
    }

    closeChange(
        _ws: string,
        changeId: string,
        to: "learned" | "declined" | "candidate",
        factId: string | null,
    ): Promise<number> {
        const rows = this.rows.filter((row) => row.changeId === changeId && row.status === "proposed")
        rows.forEach((row) => Object.assign(row, { status: to, factId: to === "learned" ? factId : null }))
        return Promise.resolve(rows.length)
    }

    private each(
        ids: ReadonlyArray<string>,
        when: (row: LessonCandidate) => boolean,
        act: (row: MemoryCandidates["rows"][number]) => unknown,
    ): void {
        this.rows.filter((row) => ids.includes(row.id) && when(row)).forEach(act)
    }
}

const ok = (output: string): GenerationOutcome => ({
    ok: true,
    output,
    generationId: randomUUID(),
    timings: {},
    usage: null,
})

const DRAFT = {
    verdict: "draft",
    subject: "Chuyển khoản sai mã",
    attribute: "Đúng số tiền của đơn đang chờ",
    value: "ghi nhận cho đơn đang chờ",
    unit: null,
    valid_to: null,
    topic: "chuyển khoản sai mã nhưng đúng số tiền",
}

interface World {
    readonly service: StopLearningService
    readonly store: MemoryCandidates
    readonly posted: Array<LearningChange>
    readonly generate: jest.Mock
    readonly resolve: jest.Mock
    readonly settle: (stop: RunStop) => Promise<{ kept: number; posted: number }>
    readonly states: Map<string, "open" | "applied" | "rejected" | "gone">
}

/** The learning over scripted model answers (no real model call), an in-memory store and a recording change door. */
const worldOf = (script: ReadonlyArray<string | GenerationOutcome>): World => {
    const store = new MemoryCandidates()
    const posted: Array<LearningChange> = []
    const queue = [...script]
    const generate = jest.fn(() => {
        const next = queue.shift()
        if (next === undefined) throw new Error("no scripted model answer left")
        return Promise.resolve(typeof next === "string" ? ok(next) : next)
    })
    const resolve = jest.fn(() => Promise.resolve(1))
    const stops = new Map<string, ReadonlyArray<RunStop>>()
    const records = { ofRun: (_ws: string, runId: string) => Promise.resolve(stops.get(runId) ?? []) }
    const states = new Map<string, "open" | "applied" | "rejected" | "gone">()
    const door: LearningChangeDoor = {
        available: () => true,
        post: (change) => {
            posted.push(change)
            states.set(`change-${posted.length}`, "open")
            return Promise.resolve({ changeId: `change-${posted.length}`, state: "open" })
        },
        stateOf: (_ws, changeId) => Promise.resolve(states.get(changeId) ?? "gone"),
    }
    const logger: Logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    const members = {
        directory: () =>
            Promise.resolve([
                { id: FOUNDER, user_id: "u-founder", display_name: "Chủ tiệm Hà", role: "owner", status: "active" },
            ]),
    }
    const service = new StopLearningService(
        { now: () => NOW },
        logger,
        records as unknown as RunStopRecordsService,
        store as unknown as LessonCandidatesService,
        { generate } as unknown as GenerationsService,
        undefined,
        door,
        { resolve } as unknown as KnowledgeGapsService,
        members as unknown as WorkspaceMembersReadService,
    )
    const settle = (stop: RunStop) => {
        stops.set(stop.runId, [stop])
        return service.settled({ workspaceId: WS, runId: stop.runId } as Parameters<StopLearningService["settled"]>[0])
    }
    return { service, store, posted, generate, resolve, settle, states }
}

const NOT_GENERAL = JSON.stringify({ general: false })
const GENERAL = JSON.stringify({ general: true })

describe("StopLearningService", () => {
    it("one answer is a candidate only: one cheap judgement, no card", async () => {
        const world = worldOf([NOT_GENERAL])
        const pass = await world.settle(
            wrongCodeStop("DH202611109999", [answerOf("Ghi nhận cho đơn 0004 đi em", "2026-11-10T09:00:00.000Z")]),
        )

        expect(pass).toEqual({ kept: 1, posted: 0 })
        expect(world.posted).toEqual([])
        expect(world.generate).toHaveBeenCalledTimes(1)
        expect(world.store.rows).toEqual([
            expect.objectContaining({ status: "candidate", general: false, thenDid: "completed" }),
        ])
    })

    it("U1: books each learning call to its lesson (the judgement to the answer's candidate), so the card can show what it cost", async () => {
        const world = worldOf([NOT_GENERAL])
        const scopes: Array<unknown> = []
        const answer = world.generate.getMockImplementation()
        world.generate.mockImplementation((...args: Array<unknown>) => {
            scopes.push(workInScope())
            return answer?.(...args)
        })

        await world.settle(
            wrongCodeStop("DH202611109999", [answerOf("Ghi nhận cho đơn 0004 đi em", "2026-11-10T09:00:00.000Z")]),
        )

        const [candidate] = world.store.rows as ReadonlyArray<{ readonly id: string }>
        expect(scopes).toEqual([expect.objectContaining({ kind: "learning", ref: `lesson:${candidate?.id ?? ""}` })])
    })

    it("two near answers make ONE card that quotes both, with who and when (2 model calls in all)", async () => {
        const world = worldOf([NOT_GENERAL, JSON.stringify(DRAFT)])
        await world.settle(
            wrongCodeStop("DH202611109999", [answerOf("Ghi nhận cho đơn đang chờ đi em", "2026-11-10T09:00:00.000Z")]),
        )
        const pass = await world.settle(
            wrongCodeStop("DH202611118888", [answerOf("Cứ ghi nhận cho đơn đang chờ", "2026-11-11T09:00:00.000Z")]),
        )

        expect(pass).toEqual({ kept: 1, posted: 1 })
        expect(world.generate).toHaveBeenCalledTimes(2)
        expect(world.posted).toHaveLength(1)
        const [card] = world.posted
        expect(card).toMatchObject({
            workspaceId: WS,
            agentId: AGENT,
            origin: "learning",
            factKey: { subjectLabel: "Chuyển khoản sai mã", attributeLabel: "Đúng số tiền của đơn đang chờ" },
            newValue: "ghi nhận cho đơn đang chờ",
            oldValue: null,
        })
        expect(card?.reason).toBe(
            "Đã hỏi chủ tiệm 2 lần về chuyển khoản sai mã nhưng đúng số tiền; chủ tiệm trả lời: 'Ghi nhận cho đơn đang chờ đi em'; " +
                "'Cứ ghi nhận cho đơn đang chờ'; đề nghị ghi thành quy định để lần sau tự xử lý.",
        )
        expect(card?.evidence).toEqual([
            expect.objectContaining({
                kind: "answer",
                quote: "Ghi nhận cho đơn đang chờ đi em",
                by: { name: "Chủ tiệm Hà", memberId: "u-founder" },
            }),
            expect.objectContaining({
                kind: "answer",
                quote: "Cứ ghi nhận cho đơn đang chờ",
                at: "2026-11-11T09:00:00.000Z",
            }),
        ])
        expect(card?.evidence[0]?.ref).toMatch(/^run:.+\/step:match$/)
        expect(world.store.rows.every((row) => row.status === "proposed" && row.changeId === "change-1")).toBe(true)
    })

    it("a rule-like single answer makes a card at once", async () => {
        const world = worldOf([
            GENERAL,
            JSON.stringify({ ...DRAFT, value: "từ giờ sai mã mà đúng số tiền thì cứ ghi nhận cho đơn đó" }),
        ])
        const pass = await world.settle(
            wrongCodeStop("DH202611109999", [
                answerOf("Từ giờ sai mã mà đúng số tiền thì cứ ghi nhận cho đơn đó nhé", "2026-11-11T09:00:00.000Z"),
            ]),
        )

        expect(pass.posted).toBe(1)
        expect(world.posted[0]?.reason).toContain("Đã hỏi chủ tiệm 1 lần")
        expect(world.store.rows[0]).toMatchObject({ general: true, status: "proposed" })
    })

    it("contradictory answers make a question card listing both, no drafted value", async () => {
        const world = worldOf([
            NOT_GENERAL,
            JSON.stringify({
                verdict: "contradiction",
                subject: DRAFT.subject,
                attribute: DRAFT.attribute,
                topic: DRAFT.topic,
                answers: [1, 2],
            }),
        ])
        await world.settle(
            wrongCodeStop("DH202611109999", [answerOf("Ghi nhận cho đơn đang chờ", "2026-11-10T09:00:00.000Z")]),
        )
        await world.settle(
            wrongCodeStop("DH202611118888", [
                answerOf("Không, sai mã thì hoàn tiền cho khách", "2026-11-11T09:00:00.000Z"),
            ]),
        )

        expect(world.posted).toHaveLength(1)
        const [card] = world.posted
        expect(card?.newValue).toBe("Không, sai mã thì hoàn tiền cho khách")
        expect(card?.reason).toContain(
            "hai câu trả lời khác nhau: 'Ghi nhận cho đơn đang chờ' (10/11) và 'Không, sai mã thì hoàn tiền cho khách' (11/11)",
        )
        expect(card?.reason).toContain("Chủ tiệm muốn ghi quy định nào?")
    })

    it("approve: the group is learned with the truth in force, and the gaps it answers close with a pointer to it", async () => {
        const world = worldOf([NOT_GENERAL, JSON.stringify(DRAFT)])
        await world.settle(
            wrongCodeStop("DH202611109999", [answerOf("Ghi nhận cho đơn đang chờ đi em", "2026-11-10T09:00:00.000Z")]),
        )
        await world.settle(
            wrongCodeStop("DH202611118888", [answerOf("Cứ ghi nhận cho đơn đang chờ", "2026-11-11T09:00:00.000Z")]),
        )

        await expect(world.service.reconcile(WS)).resolves.toBe(0)
        world.states.set("change-1", "applied")
        await expect(world.service.reconcile(WS)).resolves.toBe(1)

        expect(world.store.rows.map((row) => [row.status, row.factId])).toEqual([
            ["learned", "change-1"],
            ["learned", "change-1"],
        ])
        expect(world.resolve).toHaveBeenCalledWith(WS, expect.objectContaining({ by: "fact:change-1", module: null }))
    })

    it("reject: not proposed again for the same words; a different answer is a candidate again", async () => {
        const world = worldOf([NOT_GENERAL, JSON.stringify(DRAFT), NOT_GENERAL])
        await world.settle(
            wrongCodeStop("DH202611109999", [answerOf("Ghi nhận cho đơn đang chờ đi em", "2026-11-09T09:00:00.000Z")]),
        )
        await world.settle(
            wrongCodeStop("DH202611118888", [answerOf("Cứ ghi nhận cho đơn đang chờ", "2026-11-10T09:00:00.000Z")]),
        )
        world.states.set("change-1", "rejected")

        await world.settle(
            wrongCodeStop("DH202611117777", [answerOf("Ghi nhận cho đơn đang chờ nhé", "2026-11-11T08:00:00.000Z")]),
        )
        expect(world.generate).toHaveBeenCalledTimes(2)
        expect(world.store.rows.at(-1)?.status).toBe("declined")

        await world.settle(
            wrongCodeStop("DH202611116666", [
                answerOf("Lần này hỏi lại khách mã chuyển khoản", "2026-11-11T10:00:00.000Z"),
            ]),
        )
        expect(world.generate).toHaveBeenCalledTimes(3)
        expect(world.store.rows.at(-1)?.status).toBe("candidate")
        expect(world.posted).toHaveLength(1)
    })

    it("three failed tries post nothing and the candidates stay", async () => {
        const failed: GenerationOutcome = { ok: false, reason: "timeout", message: "busy" }
        const world = worldOf([
            NOT_GENERAL,
            failed,
            "not json",
            JSON.stringify({ ...DRAFT, value: "hoàn tiền gấp đôi cho khách" }),
        ])
        await world.settle(
            wrongCodeStop("DH202611109999", [answerOf("Ghi nhận cho đơn đang chờ đi em", "2026-11-10T09:00:00.000Z")]),
        )
        await world.settle(
            wrongCodeStop("DH202611118888", [answerOf("Cứ ghi nhận cho đơn đang chờ", "2026-11-11T09:00:00.000Z")]),
        )

        expect(world.generate).toHaveBeenCalledTimes(4)
        expect(world.posted).toEqual([])
        expect(world.store.rows.map((row) => row.status)).toEqual(["candidate", "candidate"])
    })

    it("keeps an answer once, skips a stop still applying its answer, and learns nothing from an AI error stop", async () => {
        const world = worldOf([NOT_GENERAL])
        const stop = wrongCodeStop("DH202611109999", [
            answerOf("Ghi nhận cho đơn đang chờ", "2026-11-10T09:00:00.000Z"),
        ])
        await world.settle(stop)
        await expect(world.settle(stop)).resolves.toEqual({ kept: 0, posted: 0 })

        const applying = wrongCodeStop("DH202611118888", [answerOf("Ghi nhận đi", "2026-11-11T09:00:00.000Z")], "open")
        await expect(world.settle(applying)).resolves.toEqual({ kept: 0, posted: 0 })
        await expect(
            world.settle({
                ...wrongCodeStop("X", [answerOf("Thử lại", "2026-11-11T09:30:00.000Z")]),
                kind: "ai_error",
            }),
        ).resolves.toEqual({ kept: 0, posted: 0 })
        expect(world.generate).toHaveBeenCalledTimes(1)
    })

    it("masks a phone number in the person's words and keeps no customer id", async () => {
        const world = worldOf([NOT_GENERAL])
        await world.settle(
            wrongCodeStop("DH202611109999", [
                answerOf("Gọi khách số 0912 345 678 rồi ghi nhận", "2026-11-10T09:00:00.000Z"),
            ]),
        )

        expect(world.store.rows[0]?.answer).toBe("Gọi khách số … rồi ghi nhận")
        expect(Object.keys(world.store.rows[0] ?? {})).not.toContain("leadId")
    })

    it("after learning, the next stop of the same gap finds the truth by its own words (what brain.search ranks on)", () => {
        const learned = {
            id: "fact-1",
            subjectKey: factSlugOf(DRAFT.subject),
            attribute: factSlugOf(DRAFT.attribute),
            value: DRAFT.value,
            trust: 1,
        } as unknown as FactRecord
        const next = wrongCodeStop("DH202611125555", [])
        const found = searchFacts([learned], `${next.reason} ${next.question ?? ""}`, 5)

        expect(found.map((fact) => fact.id)).toEqual(["fact-1"])
    })
})
