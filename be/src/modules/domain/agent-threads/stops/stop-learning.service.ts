import { Inject, Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { GenerationsService } from "@modules/domain/ai-generations"
import {
    LESSON_GROUPS_PROMPT_VERSION,
    LessonCandidatesService,
    STOP_LEARNING_DEFAULTS,
    contradictionReasonOf,
    freeCountOf,
    learnedReasonOf,
    lessonGroupsOf,
    lessonGroupsPrompt,
    lessonGroupsSystemOf,
    lessonItemsOf,
    type LessonCandidate,
    type LessonGroupContradiction,
    type LessonGroupLesson,
    type LessonGroupReading,
    type LessonGroupsRead,
    type StopLearningConfig,
} from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { ThreadRef } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger, withWorkScope } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { ThreadRunsService } from "../thread-runs.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { RunStop } from "./run-stop.contracts"
import { ThreadSweepService } from "../thread-sweep.service"
import { StopLearningDoorService } from "./stop-learning-door.service"
import {
    STOP_LEARNING_CONFIG,
    type LearningChange,
    type LearningChangeDecided,
    type LearningChangeDoor,
    type LearningChangeState,
    type LearningEvidence,
    type StopLearningOptions,
    type StopLearningPass,
} from "./stop-learning.contracts"
import { STATED_END_EXAMPLE, UNKNOWN_MEMBER_NAME } from "../messages/stop-learning.messages"
import { StopLearningLogEvent } from "./stop-learning.log-events"
import { answeredOf, askedOf, modelJsonOf, stopRefOf } from "./stop-learning.policy"
/** A model answer gets three tries in total (owner rule for every AI call), then nothing is posted and the candidates stay. */
const TRIES = 3

/** How long one learning call may take. */
const CALL_TIMEOUT_MS = 45_000

/** The most members read for the evidence names. */
const MEMBERS_MAX = 200

/** The name shown when a member's name cannot be read. */
const UNKNOWN_MEMBER = UNKNOWN_MEMBER_NAME

/** One learning call as `askFrom` repeats it: the workspace, the purpose metered, both prompts and the reader of an answer. */
interface LearningCall<Value> {
    /** The workspace the call is metered to. */
    readonly workspaceId: string
    /** The purpose the generations door meters. */
    readonly purpose: string
    /** The standing instructions. */
    readonly system: string
    /** The user message. */
    readonly user: string
    /** Reads a usable value from the model's output; null = a failed try. */
    readonly read: (output: string) => Value | null
}

/** What a decided state of a change does to its candidates. */
const decidedOf = (state: Exclude<LearningChangeState, "open">): LearningChangeDecided["state"] => {
    if (state === "applied") return "applied"
    if (state === "rejected") return "rejected"
    return "superseded"
}

/** An instant as the store keeps it (ISO, milliseconds). */
const isoOf = (at: string): string => new Date(at).toISOString()

@Injectable()
/**
 * The agent learns from the person's answers (owner, 2026-11-11: "when it cannot handle too many cases and must ask people, print a
 * truth graph message and the reason why"). After every drive that settled a thread, each free-text answer to an AI report stop of the run is kept
 * once as a lesson candidate (brain-lessons) of its place (same agent, workflow and step). A lesson is a candidate RULE of the shop
 * distilled from the founder's REPEATED same-kind answers (owner law `agent-knowledge-four-sources`: never generalised from one case):
 * when the free answers of the place reach the threshold (a count: two within 30 days by default), ONE model call reads the newest of
 * them (`lessonItemsOf`), GROUPS the ones that ask the same thing, says whether each group's answers agree or contradict, and drafts a
 * truth for each agreeing group naming the answers it rests on (owner 2026-11-12: code never decides what words mean). Code checks
 * the answer's integrity only (`lessonGroupsOf`: known numbers, one group per answer, enough answers, the value verbatim in one of
 * them, no engine id, no customer data) and puts the value in the store's one normal form of a value and its unit. The engine writes the reason and posts a `brain.change` card (origin `learning`) through the change door into the founder's
 * private room with the agent that asked. It never applies anything: the founder's yes on the card does (the door files it through the
 * same `BrainFactsService.propose` as every truth). A group the model reads as contradicting makes a question card on its answers. The founder's yes
 * closes the group as learned (and the knowledge gaps the truth answers, with a pointer to it); a no declines it until a new, different
 * answer comes. Every model call is metered and budgeted by the generations door, three tries in total. Without the change door, answers
 * are still kept and nothing is asked of a model.
 */
export class StopLearningService implements OnModuleInit {
    private readonly config: StopLearningConfig

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly records: RunStopRecordsService,
        private readonly candidates: LessonCandidatesService,
        @Optional() private readonly generations?: GenerationsService,
        @Optional() private readonly threads?: ThreadRunsService,
        @Optional() @Inject(StopLearningDoorService) private readonly changes?: LearningChangeDoor,
        @Optional() private readonly gaps?: KnowledgeGapsService,
        @Optional() private readonly members?: WorkspaceMembersReadService,
        @Optional() @Inject(STOP_LEARNING_CONFIG) options?: StopLearningOptions,
        @Optional() private readonly sweep?: ThreadSweepService,
    ) {
        this.config = { ...STOP_LEARNING_DEFAULTS, ...options }
    }

    /**
     * Registers on the thread runs (after every settled drive) and on the thread sweep (per workspace: the founder's decisions on the
     * cards are read back from the truth graph there too), once the app has started.
     */
    onModuleInit(): void {
        this.threads?.whenSettled(async (ref) => {
            await this.settled(ref)
        })
        this.sweep?.alsoPerWorkspace(async (workspaceId) => {
            await this.reconcile(workspaceId)
        })
    }

    /**
     * Brings the open cards of a workspace in line with the truth graph: a change the founder approved (on the card or on the Second
     * Brain page) is learned, a turned-down one declined, one that is gone (replaced) frees its answers. Answers how many it closed.
     */
    async reconcile(workspaceId: string): Promise<number> {
        const door = this.changes
        if (door === undefined) return 0
        let closed = 0
        await eachInOrder(await this.candidates.openChanges(workspaceId), async (changeId) => {
            const state = await door.stateOf(workspaceId, changeId)
            if (state === "open") return
            await this.decided({ workspaceId, changeId, state: decidedOf(state), factId: state === "applied" ? changeId : null })
            closed += 1
        })
        return closed
    }

    /** Learns from the answered stops of a run that just settled; never throws (a failure is logged, the wake is not failed). */
    async settled(ref: ThreadRef): Promise<StopLearningPass> {
        try {
            return await this.pass(ref)
        } catch (cause) {
            this.logger.error(StopLearningLogEvent.PassFailed, cause, { runId: ref.runId })
            return { kept: 0, posted: 0 }
        }
    }

    /** The founder decided a card: learned (and the gaps it answers closed), declined, or free again when another change replaced it. */
    async decided(decided: LearningChangeDecided): Promise<void> {
        const { workspaceId, changeId } = decided
        const group = await this.candidates.ofChange(workspaceId, changeId)
        if (group.length === 0) return
        if (decided.state === "applied") {
            const closed = await this.candidates.closeChange(workspaceId, changeId, "learned", decided.factId)
            await this.closeGaps(
                workspaceId,
                group,
                decided.factId === null ? `brain-change:${changeId}` : `fact:${decided.factId}`,
            )
            this.logger.info(StopLearningLogEvent.Decided, { changeId, state: decided.state, closed })
            return
        }
        const to = decided.state === "rejected" ? "declined" : "candidate"
        const closed = await this.candidates.closeChange(workspaceId, changeId, to, null)
        this.logger.info(StopLearningLogEvent.Decided, { changeId, state: decided.state, closed })
    }

    private async pass(ref: ThreadRef): Promise<StopLearningPass> {
        await this.reconcile(ref.workspaceId)
        const stops = (await this.records.ofRun(ref.workspaceId, ref.runId)).filter(
            (stop) => answeredOf(stop).length > 0,
        )
        if (stops.length === 0) return { kept: 0, posted: 0 }
        const since = new Date(this.clock.now().getTime() - this.config.windowDays * 86_400_000)
        let kept = 0
        let posted = 0
        await eachInOrder(stops, async (stop) => {
            const done = await this.keepAnswers(ref.workspaceId, stop, since)
            kept += done.kept
            posted += done.posted
        })
        if (kept > 0) this.logger.info(StopLearningLogEvent.CandidatesKept, { runId: ref.runId, kept, posted })
        return { kept, posted }
    }

    /** Keeps the answers of one stop not kept yet, and learns from each new one. */
    private async keepAnswers(workspaceId: string, stop: RunStop, since: Date): Promise<StopLearningPass> {
        const known = await this.candidates.keptOf(workspaceId, stop.id)
        const fresh = answeredOf(stop).filter((answered) => !known.has(isoOf(answered.at)))
        let kept = 0
        let posted = 0
        await eachInOrder(fresh, async (answered) => {
            const result = await this.candidates.keep(workspaceId, {
                stopId: stop.id,
                runId: stop.runId,
                agentId: stop.agentId,
                workflowId: stop.workflowId,
                stepKey: stop.stepKey,
                question: askedOf(stop),
                answer: answered.text,
                answeredBy: answered.by,
                answeredAt: isoOf(answered.at),
                thenDid: answered.thenDid,
            })
            if (!result.isNew) return
            kept += 1
            posted += await this.learn(workspaceId, result.candidate, since)
        })
        return { kept, posted }
    }

    /**
     * Whether the place of a new candidate is worth a draft now, and what the ONE draft call reads in it. A count decides the call (the
     * free answers of the place reach the threshold); the model reads which answers ask the same thing and whether they agree
     * (`lessonGroupsOf` checks only the integrity of its answer). Answers the cards posted.
     */
    private async learn(workspaceId: string, candidate: LessonCandidate, since: Date): Promise<number> {
        const door = this.changes
        if (door === undefined || !door.available() || this.generations === undefined) return 0
        const items = lessonItemsOf(await this.candidates.recent(workspaceId, candidate, since))
        if (freeCountOf(items) < this.config.threshold) return 0
        const read = await withWorkScope({ kind: "learning", ref: `lesson:${candidate.id}`, agentId: candidate.agentId }, () =>
            this.ask(
                workspaceId,
                "stop_learning_draft",
                lessonGroupsSystemOf(STATED_END_EXAMPLE),
                lessonGroupsPrompt(items),
                (output) => this.usable(lessonGroupsOf(modelJsonOf(output), items, this.config.threshold), candidate),
            ),
        )
        if (read === null) {
            this.logger.warn(StopLearningLogEvent.DraftFailed, { candidate: candidate.id, prompt: LESSON_GROUPS_PROMPT_VERSION })
            return 0
        }
        if (read.readings.length === 0) this.logger.info(StopLearningLogEvent.NoRule, { candidate: candidate.id, prompt: LESSON_GROUPS_PROMPT_VERSION })
        let posted = 0
        await eachInOrder(read.readings, async (reading) => {
            posted += await this.apply(door, workspaceId, candidate.agentId, reading)
        })
        return posted
    }

    /**
     * An answer the engine can act on: the expected JSON with at least one group standing, or no group at all (the model saw none).
     * Every dropped group is logged (numbers and the reason, never words); an answer whose every group was dropped is a failed try.
     */
    private usable(read: LessonGroupsRead | null, candidate: LessonCandidate): LessonGroupsRead | null {
        if (read === null) return null
        read.dropped.forEach((dropped) => {
            this.logger.warn(StopLearningLogEvent.GroupDropped, {
                candidate: candidate.id,
                numbers: dropped.numbers,
                why: dropped.why,
                prompt: LESSON_GROUPS_PROMPT_VERSION,
            })
        })
        return read.readings.length > 0 || read.dropped.length === 0 ? read : null
    }

    /** What one group of the answer does: a truth card, a question card, its new answers declined, or nothing while a card is open. */
    private async apply(
        door: LearningChangeDoor,
        workspaceId: string,
        agentId: string,
        reading: LessonGroupReading,
    ): Promise<number> {
        if (reading.kind === "waiting") return 0
        if (reading.kind === "declined") {
            await this.candidates.declined(
                workspaceId,
                reading.items.map((one) => one.id),
            )
            return 0
        }
        return this.propose(door, workspaceId, agentId, reading)
    }

    /** Posts the card of one group; its answers stay free when they were taken meanwhile, or the post fails. */
    private async propose(
        door: LearningChangeDoor,
        workspaceId: string,
        agentId: string,
        reading: LessonGroupLesson | LessonGroupContradiction,
    ): Promise<number> {
        const group = reading.kind === "lesson" ? reading.restsOn : reading.items
        const ids = group.map((one) => one.id)
        if (!(await this.candidates.claim(workspaceId, ids))) return 0
        const open = await this.candidates.openOfKey(workspaceId, reading.factKey)
        if (open !== null) {
            // One open card per fact key: these answers stand on it too.
            await this.candidates.proposed(workspaceId, ids, open, reading.factKey)
            return 0
        }
        try {
            const change = await this.changeOf(workspaceId, agentId, reading, group)
            const posted = await door.post(change)
            if (posted.state === "not_posted") {
                await this.candidates.release(workspaceId, ids)
                return 0
            }
            await this.candidates.proposed(workspaceId, ids, posted.changeId, reading.factKey)
            if (posted.state === "already_true") {
                // The truth already says so: nothing to ask the founder; the answers are learned on the truth in force.
                await this.decided({ workspaceId, changeId: posted.changeId, state: "applied", factId: posted.changeId })
                return 0
            }
            this.logger.info(StopLearningLogEvent.CardPosted, {
                prompt: LESSON_GROUPS_PROMPT_VERSION,
                changeId: posted.changeId,
                candidates: ids.length,
                kind: reading.kind === "lesson" ? "draft" : "contradiction",
            })
            return 1
        } catch (cause) {
            await this.candidates.release(workspaceId, ids)
            this.logger.error(StopLearningLogEvent.DraftFailed, cause, { candidates: ids.length })
            return 0
        }
    }

    /** The change card of a group: a drafted truth on the answers it rests on, or a question on exactly the answers that contradict. */
    private async changeOf(
        workspaceId: string,
        agentId: string,
        reading: LessonGroupLesson | LessonGroupContradiction,
        group: ReadonlyArray<LessonCandidate>,
    ): Promise<LearningChange> {
        const evidence = await this.evidenceOf(workspaceId, group)
        const base = { workspaceId, agentId, origin: "learning" as const, factKey: reading.factKey, oldValue: null, evidence }
        if (reading.kind === "lesson") {
            return {
                ...base,
                newValue: reading.value,
                unit: reading.unit,
                validity: reading.validTo === null ? null : { from: null, to: reading.validTo },
                reason: learnedReasonOf(reading.topic, group),
            }
        }
        // The items are oldest first: the oldest and the newest answer are put side by side, the newest is proposed verbatim.
        const older = group[0]
        const newer = group.at(-1)
        if (older === undefined || newer === undefined) return { ...base, newValue: "", unit: null, validity: null, reason: "" }
        return {
            ...base,
            newValue: newer.answer,
            unit: null,
            validity: null,
            reason: contradictionReasonOf(reading.topic, group, older, newer),
        }
    }

    /** Each answered stop as evidence: who · when · the words, and the run and step. */
    private async evidenceOf(
        workspaceId: string,
        group: ReadonlyArray<LessonCandidate>,
    ): Promise<ReadonlyArray<LearningEvidence>> {
        const directory = (await this.members?.directory(workspaceId, MEMBERS_MAX)) ?? []
        // A stop keeps the member seat that answered; the card names the account (BG4's `memberId`) and the display name.
        const seats = new Map(directory.map((member) => [member.id, member]))
        return group.map((one) => {
            const seat = seats.get(one.answeredBy)
            return {
                kind: "answer",
                quote: one.answer,
                ref: stopRefOf(one.runId, one.stepKey),
                by: { name: seat?.display_name ?? UNKNOWN_MEMBER, memberId: seat?.user_id ?? null },
                at: one.answeredAt,
            }
        })
    }

    /** The knowledge gaps the learned truth answers are closed with a pointer to it. */
    private async closeGaps(workspaceId: string, group: ReadonlyArray<LessonCandidate>, by: string): Promise<void> {
        const [first] = group
        if (this.gaps === undefined || first?.factKey == null) return
        await this.gaps.resolve(workspaceId, {
            subject: first.factKey.subjectLabel,
            attribute: first.factKey.attributeLabel,
            module: null,
            by,
        })
    }

    /**
     * One learning call through the generations door (budget checked, metered as NIVO's `guide`), three tries in total: a timeout, an
     * error or an answer `read` cannot use is tried again; a refusal of the budget or a missing engine ends at once. Null = nothing usable.
     */
    private ask<Value>(
        workspaceId: string,
        purpose: string,
        system: string,
        user: string,
        read: (output: string) => Value | null,
    ): Promise<Value | null> {
        return this.askFrom(1, { workspaceId, purpose, system, user, read })
    }

    /** Try `attempt` of a learning call and, when it gave nothing usable, the tries after it up to `TRIES`. */
    private async askFrom<Value>(attempt: number, call: LearningCall<Value>): Promise<Value | null> {
        if (this.generations === undefined || attempt > TRIES) return null
        const answer = await this.generations.generate({
            workspaceId: call.workspaceId,
            purpose: call.purpose,
            kind: "guide",
            module: "other",
            responseFormat: "json",
            timeoutMs: CALL_TIMEOUT_MS,
            messages: [
                { role: "system", content: call.system },
                { role: "user", content: call.user },
            ],
        })
        if (!answer.ok && (answer.reason === "quota" || answer.reason === "not_configured")) return null
        const value = answer.ok ? call.read(answer.output) : null
        return value ?? this.askFrom(attempt + 1, call)
    }
}
