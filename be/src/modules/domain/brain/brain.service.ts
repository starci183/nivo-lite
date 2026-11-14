import { Injectable } from "@nestjs/common"
import { BrainFactsReadService, BrainFactsService, windowEndsBeforeStart, type FactRecord, type ProposeResult } from "@modules/domain/brain-facts"
import { BrainLessonsService, type LessonRecord } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { FactDecision, FactForm, KeepCurrentInput, LessonDecision, LessonForm } from "./brain.contracts"
import { BrainLogEvent } from "./brain.log-events"
import { BrainError, BrainErrorCode } from "./errors/brain.error"
import { DocumentFactsService } from "./document-facts.service"
import { MANAGERS, rolesToDecide, splitInForce } from "./founder.policy"

/** A note without its edges; undefined when nothing is left. */
const trimmedNoteOf = (note: string | null | undefined): string | undefined => {
    const trimmed = note?.trim()
    return trimmed === "" ? undefined : trimmed
}

/** The most workspaces one upkeep pass keeps current; the rest wait for the next tick. */
const UPKEEP_WORKSPACES = 200

/** What one pass of the timed upkeep did. */
export interface BrainUpkeep {
    /** Workspaces whose upkeep was due. */
    readonly workspaces: number
    /** Scheduled facts that came in force. */
    readonly activated: number
    /** Facts in force whose end had passed. */
    readonly expired: number
    /** Workspaces whose upkeep failed (retried at the next tick). */
    readonly failed: number
    /** Document readings that waited for credits and go on now that their workspace has credits again. */
    readonly readingsResumed: number
}

@Injectable()
/**
 * What an owner or manager does on the Second Brain page. Only the founder (the owner) puts a truth in force: what the founder writes is
 * applied at once, what a manager writes arrives as a proposal like everything the agents, documents, chats or customers say, and only
 * the founder applies, chooses, splits or retires. A manager may turn a proposal down. A fact that becomes active also answers the
 * customer questions it covers.
 */
export class BrainService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly facts: BrainFactsService,
        private readonly lessons: BrainLessonsService,
        private readonly gaps: KnowledgeGapsService,
        private readonly sources: KnowledgeSourcesService,
        private readonly documentFacts: DocumentFactsService,
        private readonly reads: BrainFactsReadService,
    ) {}

    /**
     * Adds a fact, or a new value for an existing one (the old value is superseded and kept in history): in force at once when the
     * founder writes it, a proposal for the founder when a manager does.
     */
    async saveFact(userId: string, workspaceId: string, form: FactForm): Promise<ProposeResult> {
        const me = await this.manager(userId, workspaceId)
        const now = this.clock.now()
        // A window that ends before (or when) it starts is refused (the store's check would fail later); an end already past is kept and
        // filed as history (`stale`). The same value with a NEW window is the next version, never "reinforced" (`windowMovedOf`).
        if (windowEndsBeforeStart(form.validFrom, form.validTo))
            throw new BrainError({ code: BrainErrorCode.WindowInvalid })
        const result = await this.facts.propose(workspaceId, {
            subjectType: form.subjectType,
            subjectLabel: form.subjectLabel,
            attributeLabel: form.attributeLabel,
            value: form.value,
            scope: form.scope,
            modules: form.modules,
            validFrom: form.validFrom,
            validTo: form.validTo,
            sourceKind: me.role === "owner" ? "owner" : "manager",
            proposedBy: me.displayName,
            autoApply: me.role === "owner",
            evidence: [
                {
                    kind: "manual",
                    ref: `manual:${now.getTime()}`,
                    label: `${me.displayName} wrote this on the Second Brain page`,
                    quote: trimmedNoteOf(form.note),
                    at: now.toISOString(),
                },
            ],
        })
        if (form.gapId !== undefined && result.outcome !== "conflict" && result.fact.status === "active") {
            await this.gaps.answer(workspaceId, form.gapId, `fact:${result.fact.id}`)
        }
        await this.answered(workspaceId, result.fact)
        return result
    }

    /**
     * Decides a fact: apply, reject, choose among competing values, split into its own fact, or retire. Rejecting is a manager's too; so
     * is splitting, but a manager's split files the situational value as a proposal for the founder (only the founder's puts it in force).
     */
    async decideFact(userId: string, decision: FactDecision): Promise<FactRecord> {
        const me = await this.members.require(userId, decision.workspaceId, rolesToDecide(decision.action))
        const { workspaceId, id } = decision
        const fact = await this.decided(workspaceId, id, me.displayName, decision, splitInForce(me.role))
        await this.answered(workspaceId, fact)
        return fact
    }

    /** Keeps the value in force and rejects every waiting value of its key. Answers how many were rejected. */
    async keepCurrent(userId: string, input: KeepCurrentInput): Promise<number> {
        const me = await this.manager(userId, input.workspaceId)
        return this.facts.keepCurrent(
            input.workspaceId,
            input.subjectKey,
            input.attribute,
            me.displayName,
            input.installationId ?? null,
        )
    }

    /** Writes a lesson by hand; it is applied at once. */
    async saveLesson(userId: string, form: LessonForm): Promise<LessonRecord> {
        const me = await this.manager(userId, form.workspaceId)
        return this.lessons.propose(form.workspaceId, {
            module: form.module ?? null,
            title: form.title,
            body: form.body,
            appliesWhen: form.appliesWhen,
            origin: "manual",
            proposedBy: me.displayName,
            apply: true,
        })
    }

    /** Approves or turns down a proposed lesson, or retires one in force. */
    async decideLesson(userId: string, decision: LessonDecision): Promise<LessonRecord> {
        const me = await this.manager(userId, decision.workspaceId)
        if (decision.action === "retired") {
            return this.lessons.retire(decision.workspaceId, decision.id, me.displayName)
        }
        return this.lessons.decide(decision.workspaceId, decision.id, decision.action, me.displayName)
    }

    /** The owner does not need a customer question answered. */
    async dismissGap(userId: string, workspaceId: string, id: string): Promise<void> {
        const me = await this.manager(userId, workspaceId)
        await this.gaps.dismiss(workspaceId, id, me.displayName)
    }

    /** Deletes a document, then takes back what it contributed to the brain. */
    async removeSource(userId: string, workspaceId: string, sourceId: string): Promise<void> {
        const deleted = await this.sources.removeSource(userId, workspaceId, sourceId)
        await this.documentFacts.withdraw(workspaceId, sourceId, deleted.title)
        // The parts of a long document went with it: what they contributed is taken back as well.
        await eachInOrder(deleted.parts, (part) => this.documentFacts.withdraw(workspaceId, part.id, part.title))
    }

    /**
     * Keeps the brain current before it is read: scheduled values take over, ended values expire, and a truth a public document states
     * that an older build left internal is given back to customers (`repairAudience`, D-BR-1; idempotent, no model call).
     */
    async maintain(userId: string, workspaceId: string): Promise<void> {
        await this.members.require(userId, workspaceId)
        const done = await this.facts.maintain(workspaceId)
        await eachInOrder(done.activated, (fact) => this.answered(workspaceId, fact))
        const widened = await this.facts.repairAudience(workspaceId, (ids) => this.publicSources(workspaceId, ids))
        await eachInOrder(widened, (fact) => this.answered(workspaceId, fact))
    }

    /** Which of these documents customers may read (a document gone is not). */
    private async publicSources(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlySet<string>> {
        const open = new Set<string>()
        await eachInOrder(ids, async (id) => {
            const source = await this.sources.sourceOf(workspaceId, id)
            if (source?.visibility === "public") open.add(id)
        })
        return open
    }

    /**
     * The TIMED upkeep (BR1; tick `brain-upkeep` of the one app scheduler, every 5 minutes): in every workspace where a scheduled fact's
     * start has come or a fact's end has passed, the same `maintain` the Second Brain page runs, as the brain itself (no person): the
     * scheduled value comes in force (the value it replaces is superseded, relations carried), ended values expire, and a fact that came
     * in force gets its vector and answers its gaps, exactly as on the page. Idempotent: `maintain` promotes only rows still
     * `scheduled` and expires only rows still `active`, so a second tick, the page and the change door racing it change nothing twice.
     * One failing workspace is logged and retried at the next tick; the others go on. A fact left with no point (the rest of a bulk
     * apply, a write where no vector listener ran) is the vector reconcile's (tick `vector-reconcile`), never this tick's.
     */
    async upkeep(): Promise<BrainUpkeep> {
        const due = await this.reads.dueWorkspaces(UPKEEP_WORKSPACES)
        let activated = 0
        let expired = 0
        let failed = 0
        await eachInOrder(due, async (workspaceId) => {
            try {
                const done = await this.facts.maintain(workspaceId)
                activated += done.activated.length
                expired += done.expired
                await eachInOrder(done.activated, (fact) => this.answered(workspaceId, fact))
            } catch (cause) {
                failed += 1
                this.logger.error(BrainLogEvent.UpkeepFailed, cause, { workspaceId })
            }
        })
        // Documents stored word-only for want of credits are indexed again, and readings that waited for credits go on by themselves,
        // once the workspace has credits again (nothing waits for a button).
        await this.documentFacts.resumeIndexing()
        const readingsResumed = await this.documentFacts.resumeParked()
        const result = {
            workspaces: due.length,
            activated,
            expired,
            failed,
            readingsResumed,
        }
        this.logger.info(BrainLogEvent.UpkeepDone, { ...result })
        return result
    }

    /** The proof that the caller may change the brain, with the name decisions are filed under. */
    private manager(userId: string, workspaceId: string): Promise<WorkspaceMember> {
        return this.members.require(userId, workspaceId, MANAGERS)
    }

    /** Carries out the decision on the fact. */
    private decided(
        workspaceId: string,
        id: string,
        by: string,
        decision: FactDecision,
        inForce: boolean,
    ): Promise<FactRecord> {
        const note = decision.note ?? ""
        switch (decision.action) {
            case "apply":
                return this.facts.apply(workspaceId, id, by, note)
            case "reject":
                return this.facts.reject(workspaceId, id, by, note)
            case "choose":
                return this.facts.choose(workspaceId, id, by)
            case "split":
                return this.facts.split(workspaceId, id, decision.situation ?? "", by, inForce)
            case "retire":
                return this.facts.retire(workspaceId, id, by, note)
        }
    }

    /**
     * A public fact in force answers the open gaps reported under its own subject and attribute (exact keys); a failure here never blocks the fact. (Its vector came with the
     * facts store's announcement of the write, for that fact alone.)
     */
    private async answered(workspaceId: string, fact: FactRecord): Promise<void> {
        if (fact.status !== "active" || fact.scope !== "public") return
        try {
            await this.gaps.resolve(workspaceId, {
                subject: fact.subjectLabel,
                attribute: fact.attributeLabel,
                module: null,
                by: `fact:${fact.id}`,
            })
        } catch (cause) {
            this.logger.error(BrainLogEvent.GapsFailed, cause, { factId: fact.id })
        }
    }
}
