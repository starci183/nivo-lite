import { Injectable } from "@nestjs/common"
import { BrainFactsService, factLine } from "@modules/domain/brain-facts"
import type { FactRecord, ProposeResult } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { FACT_ANSWERS, KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { FactDecision, FactForm, KeepCurrentInput, LessonDecision, LessonForm } from "./brain.contracts"
import { BrainLogEvent } from "./brain.log-events"
import { DocumentFactsService } from "./document-facts.service"

/** Who may change the brain of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/**
 * What an owner or manager does on the Second Brain page. What they write is applied at once (they are the reviewer); everything the
 * agents or customers say arrives as a proposal. A fact that becomes active also answers the customer questions it covers.
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
    ) {}

    /** Adds a fact, or a new value for an existing one (the old value is superseded and kept in history). */
    async saveFact(userId: string, workspaceId: string, form: FactForm): Promise<ProposeResult> {
        const me = await this.manager(userId, workspaceId)
        const now = this.clock.now()
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
            autoApply: true,
            evidence: [
                {
                    kind: "manual",
                    ref: `manual:${now.getTime()}`,
                    label: `${me.displayName} wrote this on the Second Brain page`,
                    quote: form.note?.trim() || undefined,
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

    /** Decides a fact: apply, reject, choose among competing values, split into its own fact, or retire. */
    async decideFact(userId: string, decision: FactDecision): Promise<FactRecord> {
        const me = await this.manager(userId, decision.workspaceId)
        const { workspaceId, id } = decision
        const fact = await this.decided(workspaceId, id, me.displayName, decision)
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
    }

    /** Keeps the brain current before it is read: scheduled values take over, ended values expire. */
    async maintain(userId: string, workspaceId: string): Promise<void> {
        await this.members.require(userId, workspaceId)
        const done = await this.facts.maintain(workspaceId)
        await eachInOrder(done.activated, (fact) => this.answered(workspaceId, fact))
    }

    /** The proof that the caller may change the brain, with the name decisions are filed under. */
    private manager(userId: string, workspaceId: string): Promise<WorkspaceMember> {
        return this.members.require(userId, workspaceId, MANAGERS)
    }

    /** Carries out the decision on the fact. */
    private decided(workspaceId: string, id: string, by: string, decision: FactDecision): Promise<FactRecord> {
        const note = decision.note ?? ""
        switch (decision.action) {
            case "apply":
                return this.facts.apply(workspaceId, id, by, note)
            case "reject":
                return this.facts.reject(workspaceId, id, by, note)
            case "choose":
                return this.facts.choose(workspaceId, id, by)
            case "split":
                return this.facts.split(workspaceId, id, decision.situation ?? "", by)
            case "retire":
                return this.facts.retire(workspaceId, id, by, note)
        }
    }

    /** A public fact that is in force answers the customer questions it covers; a failure here never blocks the fact. */
    private async answered(workspaceId: string, fact: FactRecord): Promise<void> {
        if (fact.status !== "active" || fact.scope !== "public") return
        try {
            await this.gaps.resolve(workspaceId, {
                text: factLine(fact),
                minimum: FACT_ANSWERS,
                module: null,
                by: `fact:${fact.id}`,
            })
        } catch (cause) {
            this.logger.error(BrainLogEvent.GapsFailed, cause, { factId: fact.id })
        }
    }
}
