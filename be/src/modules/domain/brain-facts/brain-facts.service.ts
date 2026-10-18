import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainFactsError, BrainFactsErrorCode } from "./errors/brain-facts.error"
import { toFactRecord } from "./fact-record.mapper"
import { normalFact, mergeEvidence } from "./fact-input.policy"
import { AUTO_APPLY_TRUST, TRUST, sameValue } from "./fact-key.policy"
import { inForce, searchFacts, visibleTo } from "./fact-view.policy"
import type {
    Evidence,
    FactAudience,
    FactFilter,
    FactInput,
    FactRecord,
    FactStatus,
    InstallationScope,
    MaintenanceResult,
    MaybeFact,
    ProposeResult,
} from "./brain-facts.contracts"
import type { BrainFactRow, FactIdRow } from "./persistence/brain-facts.rows"
import {
    ACTIVATE_FACT,
    CLOSE_RETIRE_PROPOSAL,
    END_ACTIVE_AT,
    EXPIRE_DUE_FACTS,
    INSERT_FACT,
    PROMOTE_FACT,
    REJECT_FACT,
    REJECT_RETIRE_PROPOSALS,
    REJECT_SCHEDULED,
    RETIRE_FACT,
    SCHEDULE_FACT,
    SELECT_DUE_FACTS,
    SELECT_FACT,
    SELECT_FACTS,
    SELECT_FACTS_BY_KEY,
    SELECT_FACTS_OF_DOCUMENT,
    SUPERSEDE_FACT,
    UPDATE_EVIDENCE,
    UPDATE_EVIDENCE_ONLY,
} from "./persistence/brain-facts.sql"

/** The most facts a list returns. */
const LIST_MAX = 2000

/** Who acts for the brain itself when no person decides. */
const BRAIN = "NIVO"

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
    ) {}

    /** One fact of the workspace. */
    get(workspaceId: string, id: string): Promise<MaybeFact> {
        return this.fetch(this.entityManager, workspaceId, id)
    }

    /** The facts of the workspace, newest change first. */
    async list(workspaceId: string, filter: FactFilter): Promise<ReadonlyArray<FactRecord>> {
        const rows = await this.entityManager.query<Array<BrainFactRow>>(SELECT_FACTS, [
            workspaceId,
            filter.statuses ?? null,
            filter.subjectKey ?? null,
            Math.min(filter.limit ?? 500, LIST_MAX),
        ])
        return rows.map(toFactRecord)
    }

    /** The facts of a key in one status and scope. */
    byKey(
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        return this.keyed(this.entityManager, workspaceId, subjectKey, attribute, status, installationId)
    }

    /** The active facts one agent may use right now: in force and inside its view. */
    async forView(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        const at = this.clock.now().getTime()
        const active = await this.list(workspaceId, { statuses: ["active"], limit })
        return active.filter((fact) => inForce(fact, at) && visibleTo(fact, audience, module, installationId))
    }

    /** The facts of a view that match a question, best first. */
    async search(
        workspaceId: string,
        audience: FactAudience,
        module: string,
        installationId: InstallationScope,
        query: string,
        limit: number,
    ): Promise<ReadonlyArray<FactRecord>> {
        return searchFacts(await this.forView(workspaceId, audience, module, installationId, 500), query, limit)
    }

    /**
     * Records what a source says. The same value as the active fact only grows its evidence; the same value as a waiting proposal grows
     * that proposal; otherwise a new row: applied at once from a trusted source (or when `autoApply`), else a proposal naming the
     * active fact it would replace.
     */
    async propose(workspaceId: string, input: FactInput): Promise<ProposeResult> {
        const normal = normalFact(input)
        if (normal === null) throw new BrainFactsError({ code: BrainFactsErrorCode.FactIncomplete })
        const trust = TRUST[input.sourceKind]
        const evidence = input.evidence ?? []
        const scopeId = input.installationId ?? null
        const em = this.entityManager
        const [active] = await this.keyed(em, workspaceId, normal.subjectKey, normal.attribute, "active", scopeId)
        if (active !== undefined && sameValue(active.value, normal.value)) {
            const fact = await this.grow(em, workspaceId, active, evidence, trust)
            // A source confirms the value again: a waiting proposal to stop using it no longer holds.
            if (evidence.length > 0) {
                await em.query(REJECT_RETIRE_PROPOSALS, [
                    workspaceId,
                    normal.subjectKey,
                    normal.attribute,
                    scopeId,
                    "A source confirmed this value again",
                ])
            }
            return { fact, outcome: "reinforced" }
        }
        const waiting = (
            await this.keyed(em, workspaceId, normal.subjectKey, normal.attribute, "proposed", scopeId)
        ).find((proposal) => proposal.proposalKind === "set" && sameValue(proposal.value, normal.value))
        const direct = input.autoApply ?? trust >= AUTO_APPLY_TRUST
        if (waiting !== undefined) {
            const fact = await this.grow(em, workspaceId, waiting, evidence, trust)
            if (direct) return { fact: await this.apply(workspaceId, fact.id, input.proposedBy), outcome: "applied" }
            return { fact, outcome: active === undefined ? "proposed" : "conflict" }
        }
        // A new value for a known fact keeps that fact's type, audience and unit unless the caller says otherwise.
        const scope = input.scope ?? active?.scope ?? "internal"
        const [row] = await em.query<Array<BrainFactRow>>(INSERT_FACT, [
            workspaceId,
            input.subjectType ?? active?.subjectType ?? "business",
            normal.subjectKey,
            normal.subjectLabel,
            normal.attribute,
            normal.attributeLabel,
            normal.value,
            normal.valueNumber,
            input.unit?.trim() || active?.unit || null,
            scope,
            scope === "restricted" ? [...(input.modules ?? active?.modules ?? [])] : [],
            input.sourceKind,
            trust,
            input.validFrom ?? null,
            input.validTo ?? null,
            active?.id ?? null,
            JSON.stringify(evidence),
            input.proposedBy,
            scopeId,
            "set",
        ])
        const fact = this.first(row)
        if (direct) return { fact: await this.apply(workspaceId, fact.id, input.proposedBy), outcome: "applied" }
        return { fact, outcome: active === undefined ? "proposed" : "conflict" }
    }

    /**
     * Approves a proposal. Valid from now (or undated) it becomes the active fact and the current one is superseded; valid from a later
     * date it is scheduled and the current value stays in force until then. Approving a proposal to stop using a fact retires that fact.
     */
    apply(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        return this.entityManager.transaction(async (tx) => {
            const fact = await this.fetch(tx, workspaceId, id)
            if (fact === null) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
            if (fact.status !== "proposed") throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
            const [current] = await this.keyed(
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
                return this.one(tx, CLOSE_RETIRE_PROPOSAL, [workspaceId, id, decidedBy, reason ?? "Stopped using"])
            }
            if (fact.validFrom !== null && Date.parse(fact.validFrom) > this.clock.now().getTime()) {
                // Only one scheduled change per key: a newer approval replaces an older plan.
                await tx.query(REJECT_SCHEDULED, [workspaceId, fact.subjectKey, fact.attribute, fact.installationId])
                if (current !== undefined) await tx.query(END_ACTIVE_AT, [workspaceId, current.id, fact.validFrom])
                return this.one(tx, SCHEDULE_FACT, [workspaceId, id, current?.id ?? null, decidedBy, reason])
            }
            if (current !== undefined) await tx.query(SUPERSEDE_FACT, [workspaceId, current.id])
            return this.one(tx, ACTIVATE_FACT, [workspaceId, id, current?.id ?? null, decidedBy, reason])
        })
    }

    /** Turns a proposal down; it stays in the history with the reason. */
    async reject(workspaceId: string, id: string, decidedBy: string, note?: string): Promise<FactRecord> {
        const [row] = await this.entityManager.query<Array<BrainFactRow>>(REJECT_FACT, [
            workspaceId,
            id,
            decidedBy,
            note?.trim() || null,
        ])
        if (row === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.NotProposed })
        return toFactRecord(row)
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

    /** Files a proposal to stop using an active fact; one waiting proposal per fact. Answers whether one was filed. */
    async proposeRetire(workspaceId: string, active: FactRecord, why: Evidence, proposedBy: string): Promise<boolean> {
        const waiting = await this.byKey(
            workspaceId,
            active.subjectKey,
            active.attribute,
            "proposed",
            active.installationId,
        )
        if (waiting.some((proposal) => proposal.proposalKind === "retire")) return false
        await this.entityManager.query(INSERT_FACT, [
            workspaceId,
            active.subjectType,
            active.subjectKey,
            active.subjectLabel,
            active.attribute,
            active.attributeLabel,
            active.value,
            active.valueNumber,
            active.unit,
            active.scope,
            [...active.modules],
            "document",
            TRUST.document,
            null,
            null,
            active.id,
            JSON.stringify([why]),
            proposedBy,
            active.installationId,
            "retire",
        ])
        return true
    }

    /**
     * Takes one document's contribution back: proposals that rest on it alone are rejected with `note`; a proposal or fact that other
     * sources also support only loses this document from its evidence. Answers the ids of active document facts left with no evidence.
     */
    async withdrawSource(workspaceId: string, sourceId: string, note: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.query<Array<BrainFactRow>>(SELECT_FACTS_OF_DOCUMENT, [
            workspaceId,
            JSON.stringify([{ kind: "document", ref: sourceId }]),
        ])
        const orphans: Array<string> = []
        await eachInOrder(rows.map(toFactRecord), async (fact) => {
            const rest = fact.evidence.filter((item) => !(item.kind === "document" && item.ref === sourceId))
            if (fact.status === "proposed" && rest.length === 0) {
                await this.reject(workspaceId, fact.id, BRAIN, note)
                return
            }
            await this.entityManager.query(UPDATE_EVIDENCE_ONLY, [workspaceId, fact.id, JSON.stringify(rest)])
            if (fact.status === "active" && rest.length === 0 && fact.sourceKind === "document") orphans.push(fact.id)
        })
        return orphans
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
    async maintain(workspaceId: string): Promise<MaintenanceResult> {
        const due = (await this.entityManager.query<Array<BrainFactRow>>(SELECT_DUE_FACTS, [workspaceId])).map(
            toFactRecord,
        )
        const activated: Array<FactRecord> = []
        await eachInOrder(due, async (fact) => {
            const current = await this.keyed(
                this.entityManager,
                workspaceId,
                fact.subjectKey,
                fact.attribute,
                "active",
                fact.installationId,
            )
            await eachInOrder(current, (old) => this.entityManager.query(SUPERSEDE_FACT, [workspaceId, old.id]))
            const [row] = await this.entityManager.query<Array<BrainFactRow>>(PROMOTE_FACT, [workspaceId, fact.id])
            if (row !== undefined) activated.push(toFactRecord(row))
        })
        const expired = await this.entityManager.query<Array<FactIdRow>>(EXPIRE_DUE_FACTS, [workspaceId])
        return { activated, expired: expired.length }
    }

    /** One fact through a manager. */
    private async fetch(em: EntityManager, workspaceId: string, id: string): Promise<MaybeFact> {
        const [row] = await em.query<Array<BrainFactRow>>(SELECT_FACT, [workspaceId, id])
        return row === undefined ? null : toFactRecord(row)
    }

    /** The facts of a key in one status and scope through a manager. */
    private async keyed(
        em: EntityManager,
        workspaceId: string,
        subjectKey: string,
        attribute: string,
        status: FactStatus,
        installationId: InstallationScope,
    ): Promise<ReadonlyArray<FactRecord>> {
        const rows = await em.query<Array<BrainFactRow>>(SELECT_FACTS_BY_KEY, [
            workspaceId,
            subjectKey,
            attribute,
            status,
            installationId,
        ])
        return rows.map(toFactRecord)
    }

    /** Adds evidence to a fact and lifts its trust to the new source's when that is higher. */
    private grow(
        em: EntityManager,
        workspaceId: string,
        fact: FactRecord,
        evidence: ReadonlyArray<Evidence>,
        trust: number,
    ): Promise<FactRecord> {
        return this.one(em, UPDATE_EVIDENCE, [
            workspaceId,
            fact.id,
            JSON.stringify(mergeEvidence(fact.evidence, evidence)),
            Math.max(fact.trust, trust),
        ])
    }

    /** Expires an active fact. */
    private stop(
        em: EntityManager,
        workspaceId: string,
        id: string,
        decidedBy: string,
        note: string | null,
    ): Promise<FactRecord> {
        return this.one(em, RETIRE_FACT, [workspaceId, id, decidedBy, note], BrainFactsErrorCode.NotActive)
    }

    /** The fact of the one row a write answers. */
    private first(row: BrainFactRow | undefined): FactRecord {
        if (row === undefined) throw new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound })
        return toFactRecord(row)
    }

    /** The one row a write answers; the code when it changed nothing. */
    private async one(
        em: EntityManager,
        text: typeof RETIRE_FACT,
        params: ReadonlyArray<unknown>,
        code: BrainFactsErrorCode = BrainFactsErrorCode.NotProposed,
    ): Promise<FactRecord> {
        const [row] = await em.query<Array<BrainFactRow>>(text, [...params])
        if (row === undefined) throw new BrainFactsError({ code })
        return toFactRecord(row)
    }
}
