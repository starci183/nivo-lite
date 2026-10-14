import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { BrainEvalCasesService } from "@modules/domain/brain-eval-cases"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { UsageMeterService } from "@modules/domain/knowledge"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { LLM } from "@modules/integrations/llm"
import type { LlmPort } from "@modules/integrations/llm"
import { CLOCK } from "@modules/platform/clock"
import { BRAIN_OPTIONS } from "./brain.decorators"
import type { Correction, CorrectionSource } from "./brain.contracts"
import { BrainLearningService } from "./brain-learning.service"
import { LEARN_SYSTEM } from "./learn.policy"
import { ModelJsonService } from "./model-json.service"

const AT = "2026-10-12T10:00:00.000Z"
const correctionOf = builder<Correction>({
    decisionId: "d1",
    action: "send",
    outcome: "edited",
    note: null,
    at: AT,
    before: null,
    after: null,
})
const lessonOf = builder<LessonRecord>({
    id: "l1",
    module: "chatbot",
    title: "Relevant",
    body: "Keep replies short",
    appliesWhen: "When answering",
    status: "active",
    origin: "manual",
    evidence: [],
    version: 1,
    proposedBy: "owner",
    proposedAt: AT,
    decidedBy: "owner",
    decidedAt: AT,
})

const corrections = () => [
    correctionOf({ before: { draft: "Draft one" }, after: { draft: "Owner one" }, note: "Short" }),
    correctionOf({ decisionId: "d2", action: "refund", outcome: "rejected", before: { summary: "Refund" } }),
    correctionOf({ decisionId: "d3" }),
]

const build = async (list: ReadonlyArray<Correction> = corrections()) => {
    const source = mock<CorrectionSource>()
    source.recent.mockResolvedValue(list)
    const members = mock<WorkspaceMembersService>()
    const lessons = mock<BrainLessonsService>()
    lessons.list.mockResolvedValue([])
    const cases = mock<BrainEvalCasesService>()
    cases.keep.mockResolvedValue(2)
    const llm = mock<LlmPort>()
    llm.complete.mockResolvedValue({
        text: "model answer",
        model: "qwen/test",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.001 },
    })
    const usage = mock<UsageMeterService>()
    const json = mock<ModelJsonService>()
    json.jsonOf.mockReturnValue({ lessons: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainLearningService,
            { provide: BRAIN_OPTIONS, useValue: { corrections: source } },
            { provide: LLM, useValue: llm },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainLessonsService, useValue: lessons },
            { provide: BrainEvalCasesService, useValue: cases },
            { provide: UsageMeterService, useValue: usage },
            { provide: ModelJsonService, useValue: json },
            { provide: CLOCK, useValue: new FakeClock(AT) },
        ],
    }).compile()
    return { service: moduleRef.get(BrainLearningService), source, members, lessons, cases, llm, usage, json }
}

describe("BrainLearningService", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("requires a manager before reading any corrections", async () => {
        const { service, source, members, cases, llm } = await build()
        const error = new Error("forbidden")
        members.require.mockRejectedValue(error)

        await expect(service.mine("u1", "ws1", "chatbot")).rejects.toBe(error)

        expect(members.require).toHaveBeenCalledWith("u1", "ws1", ["owner", "manager"])
        expect(source.recent).not.toHaveBeenCalled()
        expect(cases.keep).not.toHaveBeenCalled()
        expect(llm.complete).not.toHaveBeenCalled()
    })

    it("keeps regression cases but skips learning below three corrections", async () => {
        const list = corrections().slice(0, 2)
        const { service, source, members, cases, lessons, llm, usage } = await build(list)

        await expect(service.mine("u1", "ws1", "chatbot")).resolves.toEqual({
            corrections: 2,
            newCases: 2,
            proposed: 0,
            reason: "not_enough",
        })

        expect(members.require).toHaveBeenCalledWith("u1", "ws1", ["owner", "manager"])
        expect(source.recent).toHaveBeenCalledWith("ws1", "chatbot", new Date("2026-07-14T10:00:00.000Z"), 60)
        expect(cases.keep).toHaveBeenCalledWith("ws1", "chatbot", [
            {
                originRef: "decision:d1",
                input: { action: "send", proposal: { draft: "Draft one" } },
                expected: { outcome: "edited", proposal: { draft: "Owner one" }, note: "Short" },
            },
            {
                originRef: "decision:d2",
                input: { action: "refund", proposal: { summary: "Refund" } },
                expected: { outcome: "rejected", proposal: null, note: null },
            },
        ])
        expect(lessons.list).not.toHaveBeenCalled()
        expect(llm.complete).not.toHaveBeenCalled()
        expect(usage.record).not.toHaveBeenCalled()
    })

    it("keeps an empty corrections window without invoking the model", async () => {
        const { service, cases, llm } = await build([])
        cases.keep.mockResolvedValue(0)

        await expect(service.mine("u1", "ws1", "chatbot")).resolves.toEqual({
            corrections: 0,
            newCases: 0,
            proposed: 0,
            reason: "not_enough",
        })

        expect(cases.keep).toHaveBeenCalledWith("ws1", "chatbot", [])
        expect(llm.complete).not.toHaveBeenCalled()
    })

    it("reports model unavailability without recording usage or parsing a result", async () => {
        const { service, llm, usage, json, lessons } = await build()
        llm.complete.mockResolvedValue(null)

        await expect(service.mine("u1", "ws1", "chatbot")).resolves.toEqual({
            corrections: 3,
            newCases: 2,
            proposed: 0,
            reason: "model_unavailable",
        })

        expect(lessons.list).toHaveBeenCalledWith("ws1", ["active", "proposed"])
        expect(usage.record).not.toHaveBeenCalled()
        expect(json.jsonOf).not.toHaveBeenCalled()
        expect(lessons.propose).not.toHaveBeenCalled()
    })

    it("meters the model call, includes applicable lessons and proposes only lessons supported by two distinct known decisions", async () => {
        const { service, llm, usage, json, lessons } = await build()
        lessons.list.mockResolvedValue([
            lessonOf(),
            lessonOf({ id: "l2", module: null, title: "Universal", body: "Be clear", status: "proposed" }),
            lessonOf({ id: "l3", module: "sales", title: "Excluded", body: "Sell gently" }),
        ])
        json.jsonOf.mockReturnValue({
            lessons: [
                { title: "Ignore", body: "Weak evidence", decisions: ["d1", "d1", "unknown"] },
                {
                    title: "Concise",
                    body: "Keep replies concise",
                    applies_when: "Before sending",
                    decisions: ["d1", "d1", "unknown", "d2"],
                },
                { title: "Review", body: "Review the draft", decisions: ["d2", "d3"] },
            ],
        })
        const prompt = [
            "EXISTING LESSONS:\n- Relevant: Keep replies short\n- Universal: Be clear",
            "CORRECTIONS (newest first):\n[d1]\nAction: send - edited\nAI draft: Draft one\nOwner's version: Owner one\nOwner's note: Short\n\n[d2]\nAction: refund - rejected\n\n[d3]\nAction: send - edited",
        ].join("\n\n")

        await expect(service.mine("u1", "ws1", "chatbot")).resolves.toEqual({
            corrections: 3,
            newCases: 2,
            proposed: 2,
        })

        expect(llm.complete).toHaveBeenCalledWith({ system: LEARN_SYSTEM, prompt, timeoutMs: 60_000 })
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: "ws1",
            kind: "guide",
            module: "other",
            model: "qwen/test",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.001 },
            promptChars: LEARN_SYSTEM.length + prompt.length,
            completionChars: 12,
        })
        expect(json.jsonOf).toHaveBeenCalledWith("model answer")
        expect(lessons.propose).toHaveBeenCalledTimes(2)
        expect(lessons.propose).toHaveBeenNthCalledWith(1, "ws1", {
            module: "chatbot",
            title: "Concise",
            body: "Keep replies concise",
            appliesWhen: "Before sending",
            origin: "edits",
            evidence: [
                { kind: "decision", ref: "d1", label: "send \u00b7 edited", at: AT },
                { kind: "decision", ref: "d2", label: "refund \u00b7 rejected", at: AT },
            ],
            proposedBy: "NIVO",
        })
        expect(lessons.propose).toHaveBeenNthCalledWith(2, "ws1", {
            module: "chatbot",
            title: "Review",
            body: "Review the draft",
            appliesWhen: "",
            origin: "edits",
            evidence: [
                { kind: "decision", ref: "d2", label: "refund \u00b7 rejected", at: AT },
                { kind: "decision", ref: "d3", label: "send \u00b7 edited", at: AT },
            ],
            proposedBy: "NIVO",
        })
    })

    it("uses the decision id as evidence if a known correction cannot be retrieved", async () => {
        const list = corrections()
        jest.spyOn(list, "find").mockReturnValueOnce(undefined)
        const { service, json, lessons } = await build(list)
        json.jsonOf.mockReturnValue({
            lessons: [{ title: "Review", body: "Review the draft", decisions: ["d1", "d2"] }],
        })

        await expect(service.mine("u1", "ws1", "chatbot")).resolves.toEqual({
            corrections: 3,
            newCases: 2,
            proposed: 1,
        })

        expect(lessons.propose).toHaveBeenCalledWith("ws1", {
            module: "chatbot",
            title: "Review",
            body: "Review the draft",
            appliesWhen: "",
            origin: "edits",
            evidence: [
                { kind: "decision", ref: "d1", label: "d1", at: undefined },
                { kind: "decision", ref: "d2", label: "refund \u00b7 rejected", at: AT },
            ],
            proposedBy: "NIVO",
        })
    })

    it("records usage even when the parsed model answer has no lessons", async () => {
        const { service, json, usage, lessons } = await build()
        json.jsonOf.mockReturnValue(null)

        await expect(service.mine("u1", "ws1", "chatbot")).resolves.toEqual({
            corrections: 3,
            newCases: 2,
            proposed: 0,
        })

        expect(usage.record).toHaveBeenCalledTimes(1)
        expect(lessons.propose).not.toHaveBeenCalled()
    })
})
