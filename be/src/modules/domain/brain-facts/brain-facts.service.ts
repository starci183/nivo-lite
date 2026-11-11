import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainFactsMaintenanceService } from "./brain-facts-maintenance.service"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { toFactRecord } from "./fact-record.mapper"
import { normalFact, mergeEvidence } from "./fact-input.policy"
import type { UnchangedPassages } from "./fact-evidence.policy"
import { AUTO_APPLY_TRUST, TRUST, sameValue } from "./fact-key.policy"
import type {
    Evidence,
    FactAudience,
    FactFilter,
    FactInput,
    FactRecord,
    FactSource,
    FactStatus,
    InstallationScope,
    MaintenanceResult,
    MaybeFact,
    ProposeResult,
    WithdrawnFacts,
} from "./brain-facts.contracts"
import { RETURNED, factKeyOf, returnedFacts } from "./fact-columns.policy"
import type { FactChanges, NewFact } from "./fact-columns.policy"
import { SUPERSEDE, activateChanges, decisionOf, nextVersion, scheduleChanges } from "./fact-write.policy"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactEntity } from "./persistence/entities"

/** Who acts for the brain itself when no person decides. */
const BRAIN = "NIVO"

/** The note of a proposal approved after its stated end: it is kept as history and never comes in force. */
const ENDED_NOTE = "Recorded as history: its stated end had already passed"

/** The note of a waiting proposal another one was merged over (flag `same_meaning`). */
const MERGED_NOTE = "Merged: the founder approved the same fact in other words"

@Injectable()
/**
 * The facts of a workspace. Exactly one ACTIVE fact per subject, attribute and scope: applying a new value supersedes the old one,
 * which is kept as history; the same value again only adds evidence; a different value from a source below the auto-apply trust is a
 * proposal that names the fact it disagrees with; nothing is ever deleted, a wrong fact is rejected or retired.
 */
export class BrainFactsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly reads: BrainFactsReadService,
        private readonly maintenance: BrainFactsMaintenanceService,
        private readonly relations: BrainFactRelationsService,
    ) {}

    /** One fact of the workspace. */
    get(workspaceId: string, id: string): Promise<MaybeFact> {
        return this.reads.get(workspaceId, id)
    }

    /** The facts of the workspace, newest change first. */
    list(workspaceId: string, filter: FactFilter): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.list(workspaceId, filter)
    }

    /** The facts of a key in one status and scope. */
    byKey(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.byKey(workspaceId, subjectKey, attribute, status, installationId)
    }

    /** The active facts one agent may use right now: in force and inside its view. */
    forView(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.forView(workspaceId, audience, module, installationId, limit)
    }

    /** The facts of a view that match a question, best first. */
    search(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.reads.search(workspaceId, audience, module, installationId, query, limit)
    }

    /**
     * Records what a source says. The same value as the active fact only grows its evidence; the same value as a waiting proposal grows
     * that proposal; otherwise a new row: applied at once from a trusted source (or when `autoApply`), else a proposal naming what it
     * disagrees with: the active fact it would replace, or, with no value in force, the newest other value waiting for the same key (so
     * two documents that disagree make ONE choice for the founder, never two silent proposals). A value whose stated end has already
     * passed is never applied at once: it is a proposal flagged `stale`.
     */
    async propose(workspaceId: string, input: FactInput): Promise<ProposeResult> {
        const normal = normalFact(input)
        if (normal === null) throw new BrainFactsError({ code: BrainFactsErrorCode.FactIncomplete })
        const trust = TRUST[input.sourceKind]
        const evidence = input.evidence ?? []
        const scopeId = input.installationId ?? null
        const em = this.entityManager
        const [active] = await this.reads.keyed(em, workspaceId, normal.subjectKey, normal.attribute, "active", scopeId)
        if (active !== undefined && sameValue(active.value, normal.value)) {
            const fact = await this.grow(em, workspaceId, active, evidence, trust)
            // A source confirms the value again: a waiting proposal to stop using it no longer holds.
            if (evidence.length > 0) {
                await em.update(
                    BrainFactEntity,
                    {
                        ...factKeyOf(workspaceId, normal.subjectKey, normal.attribute, scopeId),
                        status: "proposed",
                        proposalKind: "retire",
                    },
                    decisionOf("rejected", "A source confirmed this value again"),
                )
            }
            return { fact, outcome: "reinforced" }
        }
        const proposals = await this.reads.keyed(em, workspaceId, normal.subjectKey, normal.attribute, "proposed", scopeId)
        const values = proposals.filter((proposal) => proposal.proposalKind === "set")
        const waiting = values.find((proposal) => sameValue(proposal.value, normal.value))
        const stale = this.ended(input.validTo ?? null)
        const direct = !stale && (input.autoApply ?? trust >= AUTO_APPLY_TRUST)
        if (waiting !== undefined) {
            const fact = await this.grow(em, workspaceId, waiting, evidence, trust)
            if (direct) return { fact: await this.apply(workspaceId, fact.id, input.proposedBy), outcome: "applied" }
            return { fact, outcome: active === undefined && fact.conflictWith === null ? "proposed" : "conflict" }
        }
        // With no value in force, the newest other value waiting for the key is what this one disagrees with (`keyed` is newest first).
        const rival = active?.id ?? values[0]?.id ?? null
        // A new value for a known fact keeps that fact's type, audience and unit unless the caller says otherwise.
        const scope = input.scope ?? active?.scope ?? "internal"
        const fact = await this.insert(em, {
            workspaceId,
            subjectType: input.subjectType ?? active?.subjectType ?? "business",
            subjectKey: normal.subjectKey,
            subjectLabel: normal.subjectLabel,
            attribute: normal.attribute,
            attributeLabel: normal.attributeLabel,
            value: normal.value,
            valueNumber: normal.valueNumber === null ? null : String(normal.valueNumber),
            unit: input.unit?.trim() || active?.unit || null,
            scope,
            modules: scope === "restricted" ? [...(input.modules ?? active?.modules ?? [])] : [],
            sourceKind: input.sourceKind,
            trust,
            validFrom: input.validFrom ?? null,
            validTo: input.validTo ?? null,
            conflictWith: rival,
            evidence,
            proposedBy: input.proposedBy,
            installationId: scopeId,
            proposalKind: "set",
            ...(stale ? { reviewFlags: ["stale"] } : {}),
        })
        if (direct) {
            return { fact: await this.apply(workspaceId, fact.id, input.proposedBy), outcome: "applied", created: true }
        }
        return { fact, outcome: rival === null ? "proposed" : "conflict", created: true }
    }

    /**
     * Files the model's judgement that a waiting proposal says the SAME fact as another one in other words (another subject or attribute
     * label): the proposal is flagged `same_meaning` and names that fact in `conflictWith`, for the founder; nothing is merged here. Only a
     * proposal that still waits and disagrees with nothing is flagged. Answers whether it was.
     */
    async flagSameMeaning(workspaceId: string, id: string, sameAsId: string): Promise<boolean> {
        if (id === sameAsId) return false
        const updated = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ conflictWith: sameAsId, reviewFlags: () => "array_append(review_flags, 'same_meaning')" })
            .where({ workspaceId, id, status: "proposed", proposalKind: "set", conflictWith: IsNull() })
            .execute()
        return (updated.affected ?? 0) > 0
    }

    /**
     * The founder keeps both values (FX5, "Giữ cả hai" on a change card): a waiting proposal flagged `same_meaning` no longer names the
     * fact of the other truth, so approving it merges nothing. Answers whether it was a flagged proposal still waiting.
     */
    async keepApart(workspaceId: string, id: string): Promise<boolean> {
        const updated = await this.entityManager
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set({ conflictWith: null, reviewFlags: () => "array_remove(review_flags, 'same_meaning')" })
            .where({ workspaceId, id, status: "proposed" })
            .andWhere("'same_meaning' = ANY(review_flags)")
            .execute()
        return (updated.affected ?? 0) > 0
    }

    /**
     * Approves a proposal. Valid from now (or undated) it becomes the active fact, the next version of its key, holding for one year
     * unless its end was stated; the current one is superseded and its relations are carried to the new value. Valid from a later date
     * it is scheduled and the current value stays in force until then. Approving a proposal to stop using a fact retires that fact.
     * A proposal whose stated end has passed is recorded as history (expired) and never comes in force. A proposal flagged
     * `same_meaning` merges: the fact of the other key it names is replaced too (superseded with its relations carried, or, still
     * waiting, rejected). Who may approve is the caller's to check: the Second Brain page lets the founder alone.
     */
    apply(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        return this.entityManager.transaction(async (tx) => {
            const fact = await this.reads.fetch(tx, workspaceId, id)
            if (fact === null) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
            if (fact.status !== "proposed") throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
            const [current] = await this.reads.keyed(
                tx,
                workspaceId,
                fact.subjectKey,
                fact.attribute,
                "active",
                fact.installationId,
            )
            const reason = note?.trim() || null
            if (fact.proposalKind === "retire") {
                if (current !== undefined)
                    await this.stop(
                        tx,
                        workspaceId,
                        current.id,
                        decidedBy,
                        reason ?? "No source supports this value any more",
                    )
                return this.changed(
                    tx,
                    { workspaceId, id, status: "proposed" },
                    decisionOf("expired", reason ?? "Stopped using", decidedBy),
                    BrainFactsErrorCode.NotProposed,
                )
            }
            if (this.ended(fact.validTo)) {
                return this.changed(
                    tx,
                    { workspaceId, id, status: "proposed" },
                    decisionOf("expired", reason ?? ENDED_NOTE, decidedBy),
                    BrainFactsErrorCode.NotProposed,
                )
            }
            const merged = await this.mergedOf(tx, workspaceId, fact, current?.id ?? null)
            if (merged?.status === "proposed") {
                await this.changed(
                    tx,
                    { workspaceId, id: merged.id, status: "proposed" },
                    decisionOf("rejected", MERGED_NOTE, decidedBy),
                    BrainFactsErrorCode.NotProposed,
                )
            }
            const replaced = [current, merged?.status === "active" ? merged : undefined].filter(
                (one): one is FactRecord => one !== undefined,
            )
            if (fact.validFrom !== null && Date.parse(fact.validFrom) > this.clock.now().getTime()) {
                return this.schedule(tx, workspaceId, fact, replaced, decidedBy, reason)
            }
            await eachInOrder(replaced, (old) =>
                tx.update(BrainFactEntity, { workspaceId, id: old.id, status: "active" }, SUPERSEDE),
            )
            const [first] = replaced
            const activated = await this.changed(
                tx,
                { workspaceId, id, status: "proposed" },
                activateChanges(first?.id ?? null, decidedBy, reason, nextVersion(first)),
                BrainFactsErrorCode.NotProposed,
            )
            await eachInOrder(replaced, (old) => this.relations.carry(tx, workspaceId, old.id, id))
            return activated
        })
    }

    /**
     * The fact of another key a `same_meaning` proposal merges over, while it is still in force or waiting; null for any other
     * proposal, or when that fact was decided meanwhile.
     */
    private async mergedOf(
        tx: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        currentId: string | null,
    ): Promise<FactRecord | null> {
        const other = fact.conflictWith
        if (!(fact.flags ?? []).includes("same_meaning") || other === null || other === currentId) return null
        const found = await this.reads.fetch(tx, workspaceId, other)
        return found !== null && (found.status === "active" || found.status === "proposed") ? found : null
    }

    /** Whether a stated end has already passed. */
    private ended(validTo: string | null): boolean {
        return validTo !== null && Date.parse(validTo) <= this.clock.now().getTime()
    }

    /** Turns a proposal down; it stays in the history with the reason. */
    reject(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        return this.changed(
            this.entityManager,
            { workspaceId, id, status: "proposed" },
            decisionOf("rejected", note?.trim() || null, decidedBy),
            BrainFactsErrorCode.NotProposed,
        )
    }

    /** Stops an active fact without a replacement (no longer true): it expires now. */
    retire(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        return this.stop(this.entityManager, workspaceId, id, decidedBy, note?.trim() || null)
    }

    /** Chooses one of several competing proposals: it is applied and every other waiting proposal of the key is rejected. */
    async choose(workspaceId: string, id: string, decidedBy: string): Promise<FactRecord> {
        const winner = await this.get(workspaceId, id)
        if (winner?.status !== "proposed") throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
        if (winner.proposalKind !== "set") throw new BrainFactsError({ code: BrainFactsErrorCode.NotAValue })
        const fact = await this.apply(workspaceId, id, decidedBy, "Chosen among several different values")
        const others = await this.byKey(
            workspaceId,
            winner.subjectKey,
            winner.attribute,
            "proposed",
            winner.installationId,
        )
        await eachInOrder(
            others.filter((other) => other.id !== id),
            (other) =>
                this.reject(
                    workspaceId,
                    other.id,
                    decidedBy,
                    other.proposalKind === "retire"
                        ? "A new value was chosen"
                        : `Another value was chosen: ${winner.value}`,
                ),
        )
        return fact
    }

    /** Keeps the value in force: every proposal waiting for the key is rejected. Answers how many. */
    async keepCurrent(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        decidedBy: string,
        installationId: InstallationScope,
    ): Promise<number> {
        const waiting = await this.byKey(workspaceId, subjectKey, attribute, "proposed", installationId)
        await eachInOrder(waiting, (proposal) =>
            this.reject(workspaceId, proposal.id, decidedBy, "Kept the value in force"),
        )
        return waiting.length
    }

    /** Keeps both values: the proposal becomes its own fact for the situation it names, and the current value stays. */
    async split(workspaceId: string, id: string, situation: string, decidedBy: string): Promise<FactRecord> {
        const proposal = await this.get(workspaceId, id)
        if (proposal?.status !== "proposed") throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
        if (proposal.proposalKind !== "set") throw new BrainFactsError({ code: BrainFactsErrorCode.NotAValue })
        const label = situation.trim()
        if (label === "") throw new BrainFactsError({ code: BrainFactsErrorCode.SituationRequired })
        const { fact } = await this.propose(workspaceId, {
            subjectType: proposal.subjectType,
            subjectLabel: proposal.subjectLabel,
            attributeLabel: `${proposal.attributeLabel} (${label})`,
            value: proposal.value,
            unit: proposal.unit,
            scope: proposal.scope,
            modules: proposal.modules,
            sourceKind: proposal.sourceKind,
            validFrom: proposal.validFrom,
            validTo: proposal.validTo,
            evidence: proposal.evidence,
            proposedBy: proposal.proposedBy,
            installationId: proposal.installationId,
            autoApply: true,
        })
        await this.reject(workspaceId, id, decidedBy, `Split into its own fact: ${proposal.attributeLabel} (${label})`)
        return fact
    }

    /**
     * Files a proposal to stop using an active fact; one waiting proposal per fact. Answers whether one was filed. A document that no
     * longer says it files as `document`; a chat change request names its own source.
     */
    async proposeRetire(
        workspaceId: string,
        active: FactRecord,
        why: Evidence,
        proposedBy: string,
        sourceKind: FactSource = "document",
    ): Promise<boolean> {
        const waiting = await this.byKey(
            workspaceId,
            active.subjectKey,
            active.attribute,
            "proposed",
            active.installationId,
        )
        if (waiting.some((proposal) => proposal.proposalKind === "retire")) return false
        await this.insert(this.entityManager, {
            workspaceId,
            subjectType: active.subjectType,
            subjectKey: active.subjectKey,
            subjectLabel: active.subjectLabel,
            attribute: active.attribute,
            attributeLabel: active.attributeLabel,
            value: active.value,
            valueNumber: active.valueNumber === null ? null : String(active.valueNumber),
            unit: active.unit,
            scope: active.scope,
            modules: [...active.modules],
            sourceKind,
            trust: TRUST[sourceKind],
            validFrom: null,
            validTo: null,
            conflictWith: active.id,
            evidence: [why],
            proposedBy,
            installationId: active.installationId,
            proposalKind: "retire",
        })
        return true
    }

    /** Takes one document's contribution back; answers the ids of active document facts left with no evidence. */
    withdrawSource(workspaceId: string, sourceId: string, note: string): Promise<ReadonlyArray<string>> {
        return this.maintenance.withdrawSource(workspaceId, sourceId, note)
    }

    /** Takes back what a changed document no longer says, chunk by chunk; a fact born from an unchanged passage is not touched. */
    withdrawChanged(
        workspaceId: string,
        sourceId: string,
        note: string,
        unchanged: UnchangedPassages,
    ): Promise<WithdrawnFacts> {
        return this.maintenance.withdrawChanged(workspaceId, sourceId, note, unchanged)
    }

    /**
     * Active facts that lost their last evidence are not deleted: a proposal to stop using each is filed for the owner. A fact that got
     * evidence again, or has a competing value waiting, is skipped. Answers how many proposals were filed.
     */
    async finalizeOrphans(workspaceId: string, ids: ReadonlyArray<string>, why: Evidence): Promise<number> {
        let filed = 0
        await eachInOrder(ids, async (id) => {
            const fact = await this.get(workspaceId, id)
            if (fact?.status !== "active" || fact.evidence.length > 0) return
            const waiting = await this.byKey(
                workspaceId,
                fact.subjectKey,
                fact.attribute,
                "proposed",
                fact.installationId,
            )
            if (waiting.some((proposal) => proposal.proposalKind === "set")) return
            if (await this.proposeRetire(workspaceId, fact, why, BRAIN)) filed += 1
        })
        return filed
    }

    /** Scheduled facts whose time has come take over and ended facts expire. */
    maintain(workspaceId: string): Promise<MaintenanceResult> {
        return this.maintenance.maintain(workspaceId)
    }

    /** Adds evidence to a fact and lifts its trust to the new source's when that is higher. */
    private grow(
        em: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        evidence: ReadonlyArray<Evidence>,
        trust: number,
    ): Promise<FactRecord> {
        return this.changed(
            em,
            { workspaceId, id: fact.id },
            { evidence: () => ":evidence::jsonb", trust: Math.max(fact.trust, trust) },
            BrainFactsErrorCode.NotProposed,
            { evidence: JSON.stringify(mergeEvidence(fact.evidence, evidence)) },
        )
    }

    /** Expires an active fact. */
    private stop(
        em: EntityManager,
        workspaceId: string,
        id: string,
        decidedBy: string,
        note: string | null,
    ): Promise<FactRecord> {
        return this.changed(
            em,
            { workspaceId, id, status: "active" },
            { ...decisionOf("expired", note, decidedBy), validTo: () => "now()" },
            BrainFactsErrorCode.NotActive,
        )
    }

    /** The fact of the one row a write answers. */

    /** Approves a proposal that starts later: older plans of the key are dropped and the values in force it replaces end at the start. */
    private async schedule(
        tx: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        replaced: ReadonlyArray<FactRecord>,
        decidedBy: string,
        reason: string | null,
    ): Promise<FactRecord> {
        // Only one scheduled change per key: a newer approval replaces an older plan.
        await tx.update(
            BrainFactEntity,
            { ...factKeyOf(workspaceId, fact.subjectKey, fact.attribute, fact.installationId), status: "scheduled" },
            { status: "rejected", decisionNote: "Replaced by a newer schedule" },
        )
        await eachInOrder(replaced, (old) =>
            tx
                .createQueryBuilder(BrainFactEntity, "bf")
                .update()
                .set({ validTo: () => ":validTo::timestamptz" })
                .where({ workspaceId, id: old.id, status: "active" })
                .setParameter("validTo", fact.validFrom)
                .execute(),
        )
        return this.changed(
            tx,
            { workspaceId, id: fact.id, status: "proposed" },
            scheduleChanges(replaced[0]?.id ?? null, decidedBy, reason),
            BrainFactsErrorCode.NotProposed,
        )
    }

    /** Stores a new proposal and answers it. */
    private async insert(em: EntityManager, fact: NewFact): Promise<FactRecord> {
        const { validFrom, validTo, evidence, ...rest } = fact
        const inserted = await em
            .createQueryBuilder(BrainFactEntity, "bf")
            .insert()
            .values({
                ...rest,
                status: "proposed",
                validFrom: () => ":validFrom::timestamptz",
                validTo: () => ":validTo::timestamptz",
                evidence: () => ":evidence::jsonb",
            })
            .setParameters({ validFrom, validTo, evidence: JSON.stringify(evidence) })
            .returning(RETURNED)
            .execute()
        const [row] = returnedFacts(inserted.raw)
        if (row === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        return toFactRecord(row)
    }

    /** Changes the one fact a condition names in one atomic statement and answers it; refuses with the code when no row matched. */
    private async changed(
        em: EntityManager,
        where: FindOptionsWhere<BrainFactEntity>,
        changes: FactChanges,
        code: BrainFactsErrorCode,
        parameters: Record<string, string> = {},
    ): Promise<FactRecord> {
        const updated = await em
            .createQueryBuilder(BrainFactEntity, "bf")
            .update()
            .set(changes)
            .where(where)
            .setParameters(parameters)
            .returning(RETURNED)
            .execute()
        const [row] = returnedFacts(updated.raw)
        if (row === undefined) throw new BrainFactsError({ code })
        return toFactRecord(row)
    }
}
