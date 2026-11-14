import { Test } from "@nestjs/testing"
import { mock, type MockOf } from "@starci/jest-preset"
import { AgentViewScopeService } from "@modules/domain/agents"
import { BrainChangeRequestsService, BrainFactsService, type FactStatus, type MaybeFact } from "@modules/domain/brain-facts"
import { factOf } from "@tests/fixtures/builders/brain-facts.builder"
import {
    AGREE_SECOND_VI,
    FOUNDER_NAME_VI,
    LESSON_ATTRIBUTE_VI,
    LESSON_SUBJECT_VI,
    LESSON_VALUE_VI,
    SHORT_LEARNED_REASON_VI,
    TRANSFER_VI,
    WRONG_CODE_VI,
} from "@tests/fixtures/i18n/agent-threads-spec.messages"
import { STOP_LEARNING_CARDS, type ChangeCardPosted, type ChangeCardPoster, type LearningChange } from "./stop-learning.contracts"
import { StopLearningDoorService } from "./stop-learning-door.service"

const WS = "ws-1"

const change: LearningChange = {
    workspaceId: WS,
    agentId: "agent-1",
    origin: "learning",
    factKey: { subjectLabel: LESSON_SUBJECT_VI, attributeLabel: LESSON_ATTRIBUTE_VI },
    oldValue: null,
    newValue: LESSON_VALUE_VI,
    unit: null,
    validity: null,
    reason: SHORT_LEARNED_REASON_VI,
    evidence: [
        {
            kind: "answer",
            quote: AGREE_SECOND_VI,
            ref: "run:r1/step:match",
            by: { name: FOUNDER_NAME_VI, memberId: "u-founder" },
            at: "2026-11-11T09:00:00.000Z",
        },
    ],
}

/** The truth graph answers every proposal and read with fact-9 in this status. */
const answerFacts = (facts: MockOf<BrainFactsService>, status: FactStatus): void => {
    facts.propose.mockResolvedValue({ fact: factOf({ id: "fact-9", status }), outcome: "proposed" })
    facts.get.mockResolvedValue(factOf({ id: "fact-9", status }))
}

/** The door with a card poster and no instance readers. */
const build = async (status: FactStatus, outcome: ChangeCardPosted["outcome"] = "posted") => {
    const facts = mock<BrainFactsService>()
    answerFacts(facts, status)
    const poster = mock<ChangeCardPoster>()
    poster.post.mockResolvedValue({ outcome })
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopLearningDoorService,
            { provide: BrainFactsService, useValue: facts },
            { provide: STOP_LEARNING_CARDS, useValue: poster },
        ],
    }).compile()
    return { door: moduleRef.get(StopLearningDoorService), propose: facts.propose, post: poster.post }
}

/** The door of an app that serves no card poster. */
const buildWithoutPoster = async (status: FactStatus) => {
    const facts = mock<BrainFactsService>()
    answerFacts(facts, status)
    const moduleRef = await Test.createTestingModule({
        providers: [StopLearningDoorService, { provide: BrainFactsService, useValue: facts }],
    }).compile()
    return { door: moduleRef.get(StopLearningDoorService) }
}

/** The door with the instance readers: the asking agent's instance, and the value the change requests find for it. */
const buildScoped = async (installationId: string | null, replaced: MaybeFact) => {
    const facts = mock<BrainFactsService>()
    answerFacts(facts, "proposed")
    const poster = mock<ChangeCardPoster>()
    poster.post.mockResolvedValue({ outcome: "posted" })
    const changes = mock<BrainChangeRequestsService>()
    changes.replacedFor.mockResolvedValue(replaced)
    const scopes = mock<AgentViewScopeService>()
    scopes.lensOf.mockResolvedValue({ module: "accounting", installationId })
    const moduleRef = await Test.createTestingModule({
        providers: [
            StopLearningDoorService,
            { provide: BrainFactsService, useValue: facts },
            { provide: STOP_LEARNING_CARDS, useValue: poster },
            { provide: BrainChangeRequestsService, useValue: changes },
            { provide: AgentViewScopeService, useValue: scopes },
        ],
    }).compile()
    return { door: moduleRef.get(StopLearningDoorService), propose: facts.propose, replacedFor: changes.replacedFor }
}

describe("StopLearningDoorService", () => {
    describe("post", () => {
        it("files the truth as a proposal that never applies, then posts its one card to the founder's room with the agent", async () => {
            const { door, propose, post } = await build("proposed")

            await expect(door.post(change)).resolves.toEqual({ changeId: "fact-9", state: "open" })

            expect(propose).toHaveBeenCalledWith(
                WS,
                expect.objectContaining({
                    subjectLabel: LESSON_SUBJECT_VI,
                    value: LESSON_VALUE_VI,
                    autoApply: false,
                    sourceKind: "staff",
                    evidence: [expect.objectContaining({ kind: "decision", ref: "run:r1/step:match", quote: AGREE_SECOND_VI })],
                }),
            )
            expect(post).toHaveBeenCalledWith({
                workspaceId: WS,
                changeId: "fact-9",
                origin: "learning",
                reason: change.reason,
                evidence: change.evidence,
                agentId: "agent-1",
                roomId: null,
            })
        })

        it("posts nothing when the truth already holds the value, or when there is no room or no poster", async () => {
            const active = await build("active")
            await expect(active.door.post(change)).resolves.toEqual({ changeId: "fact-9", state: "already_true" })
            expect(active.post).not.toHaveBeenCalled()

            await expect((await build("proposed", "no_room")).door.post(change)).resolves.toMatchObject({ state: "not_posted" })
            await expect((await buildWithoutPoster("proposed")).door.post(change)).resolves.toMatchObject({ state: "not_posted" })
            expect((await buildWithoutPoster("proposed")).door.available()).toBe(false)
        })
    })

    describe("post: FX6, the scope a learned truth is filed in", () => {
        it("FX6: a learned truth is the whole shop's: workspace-wide for a single-instance agent, no instance read", async () => {
            const { door, propose, replacedFor } = await buildScoped(null, null)

            await door.post(change)

            expect(propose).toHaveBeenCalledWith(WS, expect.objectContaining({ installationId: null }))
            expect(replacedFor).not.toHaveBeenCalled()
        })

        it("FX6: an agent of one instance changes the value kept for that instance in its scope, else the workspace-wide one", async () => {
            const own = factOf({ id: "f-own", subjectLabel: TRANSFER_VI, attributeLabel: WRONG_CODE_VI, installationId: "inst-1" })
            const run = async (replaced: MaybeFact) => {
                const { door, propose, replacedFor } = await buildScoped("inst-1", replaced)
                await door.post(change)
                expect(replacedFor).toHaveBeenCalledWith(WS, change.factKey, "inst-1")
                return propose.mock.calls[0]?.[1]
            }

            expect(await run(own)).toMatchObject({ subjectLabel: TRANSFER_VI, attributeLabel: WRONG_CODE_VI, installationId: "inst-1" })
            expect(await run({ ...own, installationId: null })).toMatchObject({ installationId: null })
            expect(await run(null)).toMatchObject({ subjectLabel: LESSON_SUBJECT_VI, installationId: null })
        })
    })

    it("reads a change's state back from the truth graph", async () => {
        await expect((await build("proposed")).door.stateOf(WS, "fact-9")).resolves.toBe("open")
        await expect((await build("active")).door.stateOf(WS, "fact-9")).resolves.toBe("applied")
        await expect((await build("rejected")).door.stateOf(WS, "fact-9")).resolves.toBe("rejected")
    })
})
