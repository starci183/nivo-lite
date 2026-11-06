import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { eachInOrder } from "@modules/platform/primitives"
import { formatSequence, sequencePeriodOf } from "@nivo-lite/agent-sdk/entity"
import { mutationProblems } from "@nivo-lite/agent-sdk/mutation"
import type {
    Delete,
    Ensure,
    Insert,
    Link,
    Mutation,
    MutationBy,
    Unlink,
    Update,
    Upsert,
} from "@nivo-lite/agent-sdk/mutation"
import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EngineFailureService } from "./engine-failure.service"
import { InjectEntityEngineOptions } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import type { ScopedWork } from "./entity-engine.contracts"
import { EntityEngineService } from "./entity-engine.service"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { declaredConstraintsOf, pgFailureOf } from "./pg-failure.policy"
import type { InsertStamp } from "./policies/compiler.contracts"
import { deleteRecord } from "./policies/delete-record.policy"
import { ensureRecord } from "./policies/ensure-record.policy"
import type { Ensured } from "./policies/ensure-record.policy"
import { getRecord } from "./policies/get-record.policy"
import { insertRecord } from "./policies/insert-record.policy"
import { linkRecords, unlinkRecords } from "./policies/link-records.policy"
import { mintScopedTx } from "./policies/scoped-tx.policy"
import type { ScopedTx } from "./policies/scoped-tx.contracts"
import { updateRecord } from "./policies/update-record.policy"
import { upsertRecord } from "./policies/upsert-record.policy"
import { sequenceDateOf } from "./sequence-date.policy"

const STALE: EngineResult = { ok: false, reason: "stale" }
const MISSING: EngineResult = { ok: false, reason: "missing" }

/** A successful write: the record after it and its version. */
const okOf = (row: RecordRow): EngineResult => ({ ok: true, row, version: row.version })

/** A successful `ensure` or `upsert`: the record and whether the call inserted it. */
const createdOf = (found: Ensured): EngineResult => ({
    ok: true,
    row: found.row,
    version: found.row.version,
    created: found.created,
})

@Injectable()
/**
 * The writes of the entity engine. `mutate` validates a mutation tree against the catalog first (`mutationProblems`: an unknown entity or
 * field, the workspace or a system field in `values`, a sequence written, a value off its kind, an action writing a projection), then
 * runs it in a savepoint of the caller's scoped transaction, so a refused write leaves the surrounding transaction usable. A database
 * failure is mapped by `pgFailureOf`: a declared unique or no-overlap violation answers `taken` with the declared refusal, a check or
 * foreign-key failure answers `invalid`, and anything else is thrown as the engine error it means (`EngineFailureService`).
 */
export class EntityMutationService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly failures: EngineFailureService,
        @InjectEntityEngineOptions() private readonly options: EntityEngineOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
    ) {}

    /** Runs one mutation tree in the scope of `tx`; `by` says whether an action or a job writes. */
    async mutate(tx: ScopedTx, mutation: Mutation, by: MutationBy): Promise<EngineResult> {
        const [first] = mutationProblems(mutation, this.options.entities, by)
        if (first !== undefined)
            throw new EntityEngineError({
                code: EntityEngineErrorCode.MutationInvalid,
                params: { problem: first.code, at: first.at },
            })
        switch (mutation.op) {
            case "insert":
                return await this.write(tx, mutation.entity, (inner) => this.insert(inner, mutation))
            case "update":
                return await this.write(tx, mutation.entity, (inner) => this.update(inner, mutation))
            case "upsert":
                return await this.write(tx, mutation.entity, (inner) => this.upsert(inner, mutation))
            case "ensure":
                return await this.write(tx, mutation.entity, (inner) => this.ensure(inner, mutation))
            case "delete":
                return await this.write(tx, mutation.entity, (inner) => this.delete(inner, mutation))
            case "link":
                return await this.write(tx, mutation.entity, (inner) => this.relink(inner, mutation, linkRecords))
            case "unlink":
                return await this.write(tx, mutation.entity, (inner) => this.relink(inner, mutation, unlinkRecords))
        }
    }

    private async insert(inner: ScopedTx, mutation: Insert): Promise<EngineResult> {
        const row = await insertRecord(inner, this.engine.catalog, {
            entity: mutation.entity,
            id: this.ids.next(),
            values: mutation.values,
            stamp: this.stamp(),
        })
        await eachInOrder(Object.entries(mutation.links ?? {}), ([relation, toId]) =>
            linkRecords(inner, this.engine.catalog, { entity: mutation.entity, id: row.id, relation, toId }),
        )
        return okOf(row)
    }

    private async update(inner: ScopedTx, mutation: Update): Promise<EngineResult> {
        const outcome = await updateRecord(inner, this.engine.catalog, {
            entity: mutation.entity,
            id: mutation.key,
            expected: mutation.expected,
            patch: mutation.values,
        })
        if (outcome.kind === "ok") return okOf(outcome.row)
        return outcome.kind === "stale" ? STALE : MISSING
    }

    private async upsert(inner: ScopedTx, mutation: Upsert): Promise<EngineResult> {
        return createdOf(
            await upsertRecord(inner, this.engine.catalog, {
                entity: mutation.entity,
                constraint: mutation.on,
                values: mutation.values,
                stamp: this.stamp(),
            }),
        )
    }

    private async ensure(inner: ScopedTx, mutation: Ensure): Promise<EngineResult> {
        return createdOf(
            await ensureRecord(inner, this.engine.catalog, {
                entity: mutation.entity,
                match: mutation.match,
                values: mutation.values,
                stamp: this.stamp(),
            }),
        )
    }

    private async delete(inner: ScopedTx, mutation: Delete): Promise<EngineResult> {
        const row = await getRecord(inner, mutation.entity, mutation.key)
        if (row === null) return MISSING
        if (mutation.expected !== undefined && row.version !== mutation.expected) return STALE
        const outcome = await deleteRecord(inner, this.engine.catalog, mutation.entity, mutation.key)
        if (outcome.kind === "ok") return okOf(row)
        return outcome.kind === "missing" ? MISSING : { ok: false, reason: "invalid", constraint: outcome.relation }
    }

    private async relink(inner: ScopedTx, mutation: Link | Unlink, change: typeof linkRecords): Promise<EngineResult> {
        const row = await getRecord(inner, mutation.entity, mutation.key)
        if (row === null) return MISSING
        await change(inner, this.engine.catalog, {
            entity: mutation.entity,
            id: mutation.key,
            relation: mutation.relation,
            toId: mutation.to,
        })
        return okOf(row)
    }

    private stamp(): InsertStamp {
        const now = this.clock.now()
        return {
            now: now.toISOString(),
            newId: () => this.ids.next(),
            date: sequenceDateOf(now),
            sequences: { period: sequencePeriodOf, format: formatSequence },
        }
    }

    /** Runs a write in a savepoint of the scoped transaction and maps a database failure onto a result or an engine error. */
    private async write(tx: ScopedTx, entity: string, work: ScopedWork<EngineResult>): Promise<EngineResult> {
        const declared = declaredConstraintsOf(this.engine.definition(entity))
        try {
            return await tx.manager.transaction((manager) =>
                work(mintScopedTx({ manager, workspaceId: tx.workspaceId })),
            )
        } catch (cause) {
            const failure = pgFailureOf(cause, declared)
            if (failure.kind === "taken")
                return { ok: false, reason: "taken", constraint: failure.constraint, refusal: failure.refusal }
            if (failure.kind === "invalid")
                return failure.constraint === null
                    ? { ok: false, reason: "invalid" }
                    : { ok: false, reason: "invalid", constraint: failure.constraint }
            return this.failures.fail(cause, failure, entity)
        }
    }
}
