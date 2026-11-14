import { Injectable } from "@nestjs/common"
import { In, IsNull, type EntityManager } from "typeorm"
import type { FactRecord } from "@modules/domain/brain-facts"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { NO_INSTALLATION, type TruthKey } from "./brain-policy-candidates.service"
import { BrainPolicyEntity } from "./persistence/entities"
import { basisOf, groupKeyOf, valueTypeOf, type DeriveAsk, type DerivedPolicy, type DeriveRebind, type PolicyJudgement } from "./policy-derive.policy"

/** The most judgements one read answers (a workspace keeps a few hundred truths; the fact reads use the same order of window). */
const STORE_WINDOW = 5000

/** One judgement to store: the fact judged, the judgement so far (amend) or null (add), and what the model said. */
export interface JudgedFact extends DeriveAsk {
    /** What the model said. */
    readonly judgement: PolicyJudgement
    /** The model that said it. */
    readonly model: string
}

/** A stored row as a judgement. */
const toDerivedPolicy = (row: BrainPolicyEntity): DerivedPolicy => ({
    id: row.id,
    subjectKey: row.subjectKey,
    attribute: row.attribute,
    installationId: row.installationId,
    factId: row.factId,
    factVersion: row.factVersion,
    basis: row.basis,
    kind: row.kind,
    title: row.title,
    groupKey: row.groupKey,
    groupLabel: row.groupLabel,
    valueType: row.valueType,
    reason: row.reason,
    status: row.status,
})

/** The columns a judgement writes, from the fact it judged. */
const columnsOf = (fact: FactRecord, judgement: PolicyJudgement, model: string) => ({
    factId: fact.id,
    factVersion: fact.version ?? null,
    basis: basisOf(fact),
    kind: judgement.policy ? ("policy" as const) : ("not_policy" as const),
    title: judgement.title,
    groupKey: groupKeyOf(judgement.group),
    groupLabel: judgement.group,
    valueType: valueTypeOf(fact),
    reason: judgement.reason,
    status: "open" as const,
    model,
    retiredAt: null,
})

@Injectable()
/**
 * The stored judgements of the derived policy layer (`brain_policies`): one row per truth, never a value. Every read is one statement
 * served by `brain_policies_ws_status` (workspace + status) or `brain_policies_truth` (the truth's unique key); every write names
 * its rows by id or is an insert the unique key makes harmless to repeat.
 */
export class BrainPolicyStoreService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * Every judgement of the workspace, retired and `not_policy` ones included: the derive pass plans against all of them, and the
     * tab needs them all to count the truths not judged yet.
     */
    async all(workspaceId: string): Promise<ReadonlyArray<DerivedPolicy>> {
        const rows = await this.entityManager.find(BrainPolicyEntity, { where: { workspaceId }, take: STORE_WINDOW })
        return rows.map((row) => toDerivedPolicy(row))
    }

    /** The judgements of these truths (one statement on `brain_policies_truth`), retired and `not_policy` ones included. */
    async ofTruths(workspaceId: string, keys: ReadonlyArray<TruthKey>): Promise<ReadonlyArray<DerivedPolicy>> {
        if (keys.length === 0) return []
        const rows = await this.entityManager
            .createQueryBuilder(BrainPolicyEntity, "bp")
            .where("bp.workspaceId = :workspaceId", { workspaceId })
            .andWhere(
                `(bp.subject_key, bp.attribute, COALESCE(bp.installation_id, '${NO_INSTALLATION}'::uuid)) IN (SELECT * FROM unnest(CAST(:subjects AS text[]), CAST(:attributes AS text[]), CAST(:installations AS uuid[])))`,
                {
                    subjects: keys.map((key) => key.subjectKey),
                    attributes: keys.map((key) => key.attribute),
                    installations: keys.map((key) => key.installation),
                },
            )
            .getMany()
        return rows.map((row) => toDerivedPolicy(row))
    }

    /** Every OPEN judgement that says "policy" (the tab's rows, by the judgement table's keys; `brain_policies_ws_status`). */
    async openPolicies(workspaceId: string): Promise<ReadonlyArray<DerivedPolicy>> {
        const rows = await this.entityManager.find(BrainPolicyEntity, {
            where: { workspaceId, status: "open", kind: "policy" },
            take: STORE_WINDOW,
        })
        return rows.map((row) => toDerivedPolicy(row))
    }

    /** The groups in use among the open policies, most used first, at most `limit` (one grouped statement). */
    async groupsInUse(workspaceId: string, limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(BrainPolicyEntity, "bp")
            .select("bp.group_label", "label")
            .addSelect("COUNT(*)::int", "uses")
            .where("bp.workspaceId = :workspaceId AND bp.status = 'open' AND bp.kind = 'policy' AND bp.group_label <> ''", {
                workspaceId,
            })
            .groupBy("bp.group_label")
            .orderBy("uses", "DESC")
            .addOrderBy("bp.group_label", "ASC")
            .limit(limit)
            .getRawMany<{ label: string }>()
        return rows.map((row) => row.label)
    }

    /** Whether the workspace has any judgement yet (the first derive, or a re-derive, for the booking of the calls). */
    hasAny(workspaceId: string): Promise<boolean> {
        return this.entityManager.exists(BrainPolicyEntity, { where: { workspaceId } })
    }

    /** Open judgements whose truth NOTHING holds any more (no fact in force or scheduled), at most `limit`: one statement. */
    async orphaned(workspaceId: string, limit: number): Promise<ReadonlyArray<string>> {
        const rows: ReadonlyArray<{ readonly id: string }> = await this.entityManager.query(
            `SELECT p.id FROM public.brain_policies p
             WHERE p.workspace_id = $1 AND p.status = 'open' AND NOT EXISTS (
                SELECT 1 FROM public.brain_facts h
                WHERE h.workspace_id = p.workspace_id AND h.subject_key = p.subject_key AND h.attribute = p.attribute
                  AND COALESCE(h.installation_id, '${NO_INSTALLATION}'::uuid) = COALESCE(p.installation_id, '${NO_INSTALLATION}'::uuid)
                  AND h.status IN ('active', 'scheduled') AND h.proposal_kind = 'set' AND h.subject_type NOT IN ('customer', 'person'))
             ORDER BY p.id
             LIMIT $2`,
            [workspaceId, limit],
        )
        return rows.map((row) => row.id)
    }

    /** The judgement of one truth, or null. */
    async ofTruth(
        workspaceId: string,
        truth: Pick<FactRecord, "subjectKey" | "attribute" | "installationId">,
    ): Promise<DerivedPolicy | null> {
        const row = await this.entityManager.findOne(BrainPolicyEntity, {
            where: {
                workspaceId,
                subjectKey: truth.subjectKey,
                attribute: truth.attribute,
                installationId: truth.installationId ?? IsNull(),
            },
        })
        return row === null ? null : toDerivedPolicy(row)
    }

    /**
     * Stores what the model said: a truth judged before is amended in place (same row, by id); a new truth is inserted, and an insert
     * that meets the unique key of a truth another pass judged meanwhile is ignored (that judgement stands). Answers how many were stored.
     */
    async save(workspaceId: string, judged: ReadonlyArray<JudgedFact>): Promise<number> {
        await eachInOrder(judged, async ({ fact, known, judgement, model }) => {
            const columns = columnsOf(fact, judgement, model)
            if (known !== null) {
                await this.entityManager
                    .createQueryBuilder(BrainPolicyEntity, "bp")
                    .update()
                    .set({ ...columns, derivedAt: () => "now()" })
                    .where({ workspaceId, id: known.id })
                    .execute()
                return
            }
            await this.entityManager
                .createQueryBuilder(BrainPolicyEntity, "bp")
                .insert()
                .values({
                    workspaceId,
                    subjectKey: fact.subjectKey,
                    attribute: fact.attribute,
                    installationId: fact.installationId,
                    ...columns,
                })
                .orIgnore()
                .execute()
        })
        return judged.length
    }

    /** Judgements follow their truth to the fact that holds it now (and stand again when the truth is held again): no model call. */
    async rebind(workspaceId: string, moves: ReadonlyArray<DeriveRebind>): Promise<void> {
        await eachInOrder(moves, (move) =>
            this.entityManager.update(
                BrainPolicyEntity,
                { workspaceId, id: move.id },
                { factId: move.factId, factVersion: move.factVersion, valueType: move.valueType, status: "open", retiredAt: null },
            ),
        )
    }

    /** Judgements whose truth nothing holds any more are retired (kept: the truth may be set again). */
    async retire(workspaceId: string, ids: ReadonlyArray<string>): Promise<void> {
        if (ids.length === 0) return
        await this.entityManager
            .createQueryBuilder(BrainPolicyEntity, "bp")
            .update()
            .set({ status: "retired", retiredAt: () => "now()" })
            .where({ workspaceId, id: In([...ids]), status: "open" })
            .execute()
    }
}
