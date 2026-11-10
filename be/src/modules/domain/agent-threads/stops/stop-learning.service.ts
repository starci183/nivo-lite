import { Inject, Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { GenerationsService } from "@modules/domain/ai-generations"
import {
    LessonCandidatesService,
    STOP_LEARNING_DEFAULTS,
    contradictionReasonOf,
    learnedReasonOf,
    namesCustomerData,
    sameAnswer,
    withinWords,
} from "@modules/domain/brain-lessons"
import type { LessonCandidate, StopLearningConfig } from "@modules/domain/brain-lessons"
import { FACT_ANSWERS, KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import type { ThreadRef } from "@modules/integrations/langgraph"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger, withWorkScope } from "@modules/platform/logging"
import { ThreadRunsService } from "../thread-runs.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { RunStop } from "./run-stop.contracts"
import { ThreadSweepService } from "../thread-sweep.service"
import { StopLearningDoorService } from "./stop-learning-door.service"
import { STOP_LEARNING_CONFIG, StopLearningLogEvent } from "./stop-learning.contracts"
import type {
    LearningChange,
    LearningChangeDecided,
    LearningChangeDoor,
    LearningEvidence,
    StopLearningOptions,
    StopLearningPass,
} from "./stop-learning.contracts"
import {
    DRAFT_SYSTEM,
    JUDGE_SYSTEM,
    answeredOf,
    askedOf,
    draftPrompt,
    judgePrompt,
    judgedOf,
    stopRefOf,
    verdictOf,
} from "./stop-learning.policy"
import type { LearningVerdict } from "./stop-learning.policy"

/** A model answer gets three tries in total (owner rule for every AI call), then nothing is posted and the candidates stay. */
const TRIES = 3

/** How long one learning call may take. */
const CALL_TIMEOUT_MS = 45_000

/** The most answered stops one draft reads. */
const DRAFT_MAX = 10

/** The most members read for the evidence names. */
const MEMBERS_MAX = 200

/** The name shown when a member's name cannot be read. */
const UNKNOWN_MEMBER = "Thành viên"

/** An instant as the store keeps it (ISO, milliseconds). */
const isoOf = (at: string): string => new Date(at).toISOString()

@Injectable()
/**
 * The agent learns from the person's answers (owner, 2026-11-11: "khi mà không xử lý được quá nhiều phải hỏi người → in ra message
 * truth graph và lí do sao"). After every drive that settled a thread, each free-text answer to an AI report stop of the run is kept
 * once as a lesson candidate (brain-lessons), grouped with the earlier answers to the same gap (same agent, workflow and step, near
 * question words). When the group reaches the threshold (two answers within 30 days by default), or ONE answer states a rule (one cheap
 * model judgement at answer time), ONE model call drafts the truth from the group's own words; the engine writes the reason and posts
 * a `brain.change` card (origin `learning`) through the change door into the founder's private room with the agent that asked. It never
 * applies anything: the founder's yes on the card does. Answers that disagree make a question card instead of a draft. The founder's yes
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
        for (const changeId of await this.candidates.openChanges(workspaceId)) {
            const state = await door.stateOf(workspaceId, changeId)
            if (state === "open") continue
            const decided = state === "applied" ? "applied" : state === "rejected" ? "rejected" : "superseded"
            await this.decided({ workspaceId, changeId, state: decided, factId: state === "applied" ? changeId : null })
            closed += 1
        }
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
        for (const stop of stops) {
            const done = await this.keepAnswers(ref.workspaceId, stop, since)
            kept += done.kept
            posted += done.posted
        }
        if (kept > 0) this.logger.info(StopLearningLogEvent.CandidatesKept, { runId: ref.runId, kept, posted })
        return { kept, posted }
    }

    /** Keeps the answers of one stop not kept yet, and learns from each new one. */
    private async keepAnswers(workspaceId: string, stop: RunStop, since: Date): Promise<StopLearningPass> {
        const known = await this.candidates.keptOf(workspaceId, stop.id)
        const fresh = answeredOf(stop).filter((answered) => !known.has(isoOf(answered.at)))
        let kept = 0
        let posted = 0
        for (const answered of fresh) {
            const result = await this.candidates.keep(
                workspaceId,
                {
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
                },
                since,
            )
            if (!result.isNew) continue
            kept += 1
            posted += await this.learn(workspaceId, result.candidate, since)
        }
        return { kept, posted }
    }

    /** Whether a new candidate makes its group worth a truth now; posts the card when it does. Answers the cards posted (0 or 1). */
    private async learn(workspaceId: string, candidate: LessonCandidate, since: Date): Promise<number> {
        const door = this.changes
        if (door === undefined || !door.available() || this.generations === undefined) return 0
        const group = (await this.candidates.recent(workspaceId, candidate, since)).filter(
            (one) => one.groupId === candidate.groupId,
        )
        // Turned down before in the same words: not proposed again until an answer differs.
        if (group.some((one) => one.status === "declined" && sameAnswer(one.answer, candidate.answer))) {
            await this.candidates.declined(workspaceId, [candidate.id])
            return 0
        }
        // A card of this gap is open: the founder decides it first.
        if (group.some((one) => one.status === "proposed" || one.status === "proposing")) return 0
        const live = group.filter((one) => one.status === "candidate").toReversed()
        if (live.length >= this.config.threshold)
            return this.propose(door, workspaceId, candidate.agentId, live.slice(-DRAFT_MAX))
        const general = (await this.judge(workspaceId, candidate)) ?? false
        await this.candidates.judged(workspaceId, candidate.id, general)
        return general ? this.propose(door, workspaceId, candidate.agentId, [candidate]) : 0
    }

    /** One cheap judgement: does the answer state a general rule? Null when no usable answer came in three tries. */
    private judge(workspaceId: string, candidate: LessonCandidate): Promise<boolean | null> {
        // Booked to the lesson (U1): the card of the change this candidate joins shows what learning it cost.
        return withWorkScope({ kind: "learning", ref: `lesson:${candidate.id}`, agentId: candidate.agentId }, () =>
            this.ask(
                workspaceId,
                "stop_learning_judge",
                JUDGE_SYSTEM,
                judgePrompt(candidate.question, candidate.answer),
                judgedOf,
            ),
        )
    }

    /** Drafts the group's truth and posts its card; the candidates stay free when nothing usable comes or the post fails. */
    private async propose(
        door: LearningChangeDoor,
        workspaceId: string,
        agentId: string,
        group: ReadonlyArray<LessonCandidate>,
    ): Promise<number> {
        const ids = group.map((one) => one.id)
        if (!(await this.candidates.claim(workspaceId, ids))) return 0
        // Booked to the newest lesson of the group (U1): every lesson of the group gets the change id, so the card finds it.
        const verdict = await withWorkScope({ kind: "learning", ref: `lesson:${ids.at(-1) ?? ""}`, agentId }, () =>
            this.ask(workspaceId, "stop_learning_draft", DRAFT_SYSTEM, draftPrompt(group), (output) =>
                this.usable(verdictOf(output), group),
            ),
        )
        const groupId = group[0]?.groupId ?? null
        if (verdict === null || verdict.verdict === "none") {
            await this.candidates.release(workspaceId, ids)
            this.logger.warn(verdict === null ? StopLearningLogEvent.DraftFailed : StopLearningLogEvent.NoRule, {
                group: groupId,
            })
            return 0
        }
        const open = await this.candidates.openOfKey(workspaceId, verdict.factKey)
        if (open !== null) {
            // One open card per fact key: these answers stand on it too.
            await this.candidates.proposed(workspaceId, ids, open, verdict.factKey)
            return 0
        }
        try {
            const change = await this.changeOf(workspaceId, agentId, verdict, group)
            const posted = await door.post(change)
            if (posted.state === "not_posted") {
                await this.candidates.release(workspaceId, ids)
                return 0
            }
            await this.candidates.proposed(workspaceId, ids, posted.changeId, verdict.factKey)
            if (posted.state === "already_true") {
                // The truth already says so: nothing to ask the founder; the answers are learned on the truth in force.
                await this.decided({
                    workspaceId,
                    changeId: posted.changeId,
                    state: "applied",
                    factId: posted.changeId,
                })
                return 0
            }
            this.logger.info(StopLearningLogEvent.CardPosted, {
                changeId: posted.changeId,
                candidates: ids.length,
                kind: verdict.verdict,
            })
            return 1
        } catch (cause) {
            await this.candidates.release(workspaceId, ids)
            this.logger.error(StopLearningLogEvent.DraftFailed, cause, { group: groupId })
            return 0
        }
    }

    /** A verdict the engine can post: a draft within the person's words and naming no customer, or a contradiction of two real answers. */
    private usable(verdict: LearningVerdict, group: ReadonlyArray<LessonCandidate>): LearningVerdict {
        if (verdict === null || verdict.verdict === "none") return verdict
        const labels = `${verdict.factKey.subjectLabel} ${verdict.factKey.attributeLabel}`
        if (namesCustomerData(labels)) return null
        if (verdict.verdict === "contradiction") {
            return verdict.answers.every((at) => at >= 1 && at <= group.length) ? verdict : null
        }
        const said = group.map((one) => one.answer)
        return withinWords(verdict.value, said) && !namesCustomerData(verdict.value) ? verdict : null
    }

    /** The change card the verdict makes: a drafted truth, or a question listing the two answers that disagree (no draft: the newest words are put forward verbatim). */
    private async changeOf(
        workspaceId: string,
        agentId: string,
        verdict: Exclude<LearningVerdict, null | { readonly verdict: "none" }>,
        group: ReadonlyArray<LessonCandidate>,
    ): Promise<LearningChange> {
        const evidence = await this.evidenceOf(workspaceId, group)
        const base = {
            workspaceId,
            agentId,
            origin: "learning" as const,
            factKey: verdict.factKey,
            oldValue: null,
            evidence,
        }
        if (verdict.verdict === "draft") {
            return {
                ...base,
                newValue: verdict.value,
                unit: verdict.unit,
                validity: verdict.validity,
                reason: learnedReasonOf(verdict.topic, group),
            }
        }
        // `usable` proved both positions are answers of the group.
        const pair = verdict.answers
            .map((at) => group[at - 1])
            .filter((one): one is LessonCandidate => one !== undefined)
            .toSorted((left, right) => left.answeredAt.localeCompare(right.answeredAt))
        const older = pair[0] ?? group[0]
        const newer = pair[1] ?? group.at(-1)
        if (older === undefined || newer === undefined)
            return { ...base, newValue: "", unit: null, validity: null, reason: "" }
        return {
            ...base,
            newValue: newer.answer,
            unit: null,
            validity: null,
            reason: contradictionReasonOf(verdict.topic, group, older, newer),
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
        const text = [first.factKey.subjectLabel, first.factKey.attributeLabel, ...group.map((one) => one.answer)].join(
            " ",
        )
        await this.gaps.resolve(workspaceId, { text, minimum: FACT_ANSWERS, module: null, by })
    }

    /**
     * One learning call through the generations door (budget checked, metered as NIVO's `guide`), three tries in total: a timeout, an
     * error or an answer `read` cannot use is tried again; a refusal of the budget or a missing engine ends at once. Null = nothing usable.
     */
    private async ask<Value>(
        workspaceId: string,
        purpose: string,
        system: string,
        user: string,
        read: (output: string) => Value | null,
    ): Promise<Value | null> {
        if (this.generations === undefined) return null
        for (let attempt = 1; attempt <= TRIES; attempt += 1) {
            const answer = await this.generations.generate({
                workspaceId,
                purpose,
                kind: "guide",
                module: "other",
                responseFormat: "json",
                timeoutMs: CALL_TIMEOUT_MS,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
            })
            if (!answer.ok && (answer.reason === "quota" || answer.reason === "not_configured")) return null
            const value = answer.ok ? read(answer.output) : null
            if (value !== null) return value
        }
        return null
    }
}
