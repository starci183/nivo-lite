import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { eachInOrder } from "@modules/platform/primitives"
import { formatSequence, sequencePeriodOf, type EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import {
    mutationProblems,
    type Delete,
    type Ensure,
    type Insert,
    type Link,
    type Mutation,
    type MutationBy,
    type Unlink,
    type Update,
    type Upsert,
} from "@nivo-lite/agent-sdk/mutation"
import type { EngineResult, RecordRow, WriteValues } from "@nivo-lite/agent-sdk/entity/port"
import { EngineFailureService } from "./engine-failure.service"
import { InjectEntityEngineOptions, InjectRecordContacts } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import type { ScopedWork } from "./entity-engine.contracts"
import { EntityEngineService } from "./entity-engine.service"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { declaredConstraintsOf, pgFailureOf } from "./pg-failure.policy"
import type { InsertStamp } from "./policies/compiler.contracts"
import { contactFieldsOf, contactIdsOf, contactRuleOf, withCurrentContacts } from "./policies/contact-values.policy"
import { recordsOfAgent, softDeleteAgentRecords } from "./policies/agent-records.policy"
import { deleteRecord, deleteRecords, type DeleteTarget } from "./policies/delete-record.policy"
import { ensureRecord, type Ensured } from "./policies/ensure-record.policy"
import { getRecord } from "./policies/get-record.policy"
import { insertRecord } from "./policies/insert-record.policy"
import { linkRecords, linkTargetIsLive, unlinkRecords } from "./policies/link-records.policy"
import { mintScopedTx } from "./policies/scoped-tx.policy"
import type { ScopedTx } from "./policies/scoped-tx.contracts"
import { recordsOfContacts } from "./policies/records-of-contacts.policy"
import { requireAgentScope } from "./policies/record-scope.policy"
import { insertStateRefusal, movesState, updateStateRefusal } from "./policies/state-transition.policy"
import { updateRecord } from "./policies/update-record.policy"
import type { RecordContactsPort } from "./record-contacts.port"
import { upsertRecord } from "./policies/upsert-record.policy"
import { sequenceDateOf } from "./sequence-date.policy"

const STALE: EngineResult = { ok: false, reason: "stale" }
const MISSING: EngineResult = { ok: false, reason: "missing" }

/** A write the type's own rules refuse (a contact the workspace does not hold, a state change it does not declare): `invalid`. */
const invalidAt = (constraint: string): EngineResult => ({ ok: false, reason: "invalid", constraint })

/** What erasing the records of contacts came to: how many went (cascades included) and were cleared, and the objects of their files. */
export type ContactErasure =
    | {
          readonly kind: "erased"
          /** Records removed (the cascaded ones included). */
          readonly erased: number
          /** Records whose contact field was cleared. */
          readonly cleared: number
          /** The object keys of the files the removed records held: removed from the store by the caller once committed. */
          readonly files: ReadonlyArray<string>
      }
    /** A `restrict` ref still links to a record the erase would remove: nothing was written. */
    | { readonly kind: "blocked"; readonly relation: string }

/** What erasing an agent's records came to: how many records went, and the object keys of the files they held (for the caller to remove once committed). */
export interface AgentErasure {
    /** Records removed. */
    readonly erased: number
    /** The object keys of the files the removed records held. */
    readonly files: ReadonlyArray<string>
}

/** One record of a type that points at a contact. */
export interface ContactRecord {
    /** The record type. */
    readonly type: string
    /** The record id. */
    readonly id: string
}

/** A record the erase keeps as it is (every contact field that points at the person is declared `clear`). */
interface ClearedRecord {
    readonly entity: string
    readonly id: string
}

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
        @Optional() @InjectRecordContacts() private readonly contacts?: RecordContactsPort,
    ) {}

    /**
     * Runs one mutation tree in the scope of `tx`; `by` says whether an action or a job writes. A write of an agent-scoped type in a scope
     * no agent is behind is refused (`AgentMissing`) before any statement; a contact field must name a contact of the workspace (stored as
     * the id it stands for now); a declared state moves only along its declared transitions.
     */
    async mutate(tx: ScopedTx, mutation: Mutation, by: MutationBy): Promise<EngineResult> {
        const [first] = mutationProblems(mutation, this.options.entities, by)
        if (first !== undefined)
            throw new EntityEngineError({
                code: EntityEngineErrorCode.MutationInvalid,
                params: { problem: first.code, at: first.at },
            })
        requireAgentScope(tx, mutation.entity)
        switch (mutation.op) {
            case "insert":
                return await this.proven(tx, mutation.entity, mutation.values, (values) =>
                    this.write(tx, mutation.entity, (inner) => this.insert(inner, { ...mutation, values })),
                )
            case "update":
                return await this.proven(tx, mutation.entity, mutation.values, (values) =>
                    this.write(tx, mutation.entity, (inner) => this.update(inner, { ...mutation, values })),
                )
            case "upsert":
                return await this.proven(tx, mutation.entity, mutation.values, (values) =>
                    this.write(tx, mutation.entity, (inner) => this.upsert(inner, { ...mutation, values })),
                )
            case "ensure":
                return await this.proven(tx, mutation.entity, mutation.values, (values) =>
                    this.write(tx, mutation.entity, (inner) => this.ensure(inner, { ...mutation, values })),
                )
            case "delete":
                return await this.write(tx, mutation.entity, (inner) => this.delete(inner, mutation))
            case "link":
                return await this.write(tx, mutation.entity, (inner) => this.relink(inner, mutation, linkRecords))
            case "unlink":
                return await this.write(tx, mutation.entity, (inner) => this.relink(inner, mutation, unlinkRecords))
        }
    }

    /**
     * Erases, in ONE transaction of the workspace across every agent, the records whose contact fields point at the contacts (the ids
     * merged into them included: the caller passes them): a field declared `erase` (the default: the record dies with its contact)
     * SOFT-deletes the record, its cascades with it; a record whose fields are all declared `clear` STAYS AS IT IS, its reference kept
     * (R31: an erasure never rewrites a record; DEF-6 found the order's `contactId` rewritten to null): the erased contact reads as no live
     * person wherever a read goes through it (`RecordContactsPort.aliasesOf` answers an erased contact no id, so a filter on it matches
     * nothing), and a business read decides by the contact's liveness what the kept record still means. `cleared` counts those records.
     * A `restrict` ref to a record the erase would remove refuses it before anything is written. No file is handed back to remove: a
     * soft-deleted record keeps its row and its files.
     */
    async eraseForContacts(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ContactErasure> {
        return await this.engine.scoped(workspaceId, async (tx): Promise<ContactErasure> => {
            const erase: Array<DeleteTarget> = []
            const clear: Array<ClearedRecord> = []
            const ids = new Set(contactIds)
            await eachInOrder([...this.engine.catalog.values()], async (entity) => {
                const fields = contactFieldsOf(entity)
                const rows = await recordsOfContacts(tx, this.engine.catalog, entity, fields.map(([name]) => name), contactIds)
                for (const row of rows) {
                    const hit = fields.filter(([name]) => ids.has(String(row.data[name])))
                    if (hit.some(([, field]) => contactRuleOf(field) === "erase")) erase.push({ entity: entity.name, id: row.id })
                    else clear.push({ entity: entity.name, id: row.id })
                }
            })
            const removed = await deleteRecords(tx, this.engine.catalog, erase, { force: true })
            if (removed.kind === "blocked") return removed
            const gone = new Set(removed.removed.map((record) => `${record.entity}:${record.id}`))
            // The records a `clear` field ties to the person are kept untouched, the reference with them (never patched to null).
            const cleared = clear.filter((record) => !gone.has(`${record.entity}:${record.id}`))
            // A soft delete keeps the row and so its files: nothing is handed back to remove (owner order: only soft delete).
            return { kind: "erased", erased: removed.removed.length, cleared: cleared.length, files: [] }
        })
    }

    /**
     * SOFT-deletes, in ONE transaction of the workspace, every live record the agent owns (`deleted_at` set, `version` bumped; owner order:
     * nothing is hard-deleted). Links, rows and files stay, the agent's own row is not touched (its removal pauses it and marks the
     * installation removed), so no object is handed back to remove. The agent is named, never taken from a scope. With `manager` (the
     * transaction of the removal that asked) the delete joins it, so the records go with the removal or not at all.
     */
    async eraseForAgent(workspaceId: string, agentId: string, manager?: EntityManager): Promise<AgentErasure> {
        const work = async (tx: ScopedTx): Promise<AgentErasure> => {
            const sets = await recordsOfAgent(tx, this.engine.catalog, agentId)
            const erased = await softDeleteAgentRecords(tx, sets)
            // A soft delete keeps every row and so every file: nothing is handed back to remove.
            return { erased, files: [] }
        }
        return manager === undefined
            ? await this.engine.scoped(workspaceId, work)
            : await this.engine.within(manager, workspaceId, work)
    }

    /** The records of a type whose contact fields point at the contacts, of every agent, newest first. */
    async recordsOfContacts(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
        type: string,
    ): Promise<ReadonlyArray<ContactRecord>> {
        const entity = this.engine.definition(type)
        const fields = contactFieldsOf(entity).map(([name]) => name)
        return await this.engine.scoped(workspaceId, async (tx) =>
            (await recordsOfContacts(tx, this.engine.catalog, entity, fields, contactIds)).map((row) => ({ type, id: row.id })),
        )
    }

    /**
     * Runs a write with its contact fields proven: each contact id must be one of the workspace's active contacts (`invalid` at the field
     * otherwise, before any statement), stored as the id it stands for now. With no contacts port bound a contact value cannot be proven
     * and is refused.
     */
    private async proven(
        tx: ScopedTx,
        entityName: string,
        values: WriteValues,
        write: (values: WriteValues) => Promise<EngineResult>,
    ): Promise<EngineResult> {
        const entity: EntityDefinition = this.engine.definition(entityName)
        const asked = contactIdsOf(entity, values)
        if (asked.length === 0) return await write(values)
        const current = this.contacts === undefined ? new Map<string, string>() : await this.contacts.currentOf(tx.workspaceId, asked)
        const fitted = withCurrentContacts(entity, values, current)
        if (!fitted.ok) return invalidAt(fitted.field)
        return await write({ ...values, ...fitted.contacts })
    }

    private async insert(inner: ScopedTx, mutation: Insert): Promise<EngineResult> {
        const refused = insertStateRefusal(this.engine.definition(mutation.entity), mutation.values)
        if (refused !== null) return invalidAt(refused)
        // A link to a deleted (or absent) target is refused before the record is written.
        for (const [relation, toId] of Object.entries(mutation.links ?? {})) {
            if (!(await linkTargetIsLive(inner, this.engine.catalog, { entity: mutation.entity, relation, toId }))) return MISSING
        }
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
        const entity = this.engine.definition(mutation.entity)
        if (movesState(entity, mutation.values)) {
            const current = await getRecord(inner, mutation.entity, mutation.key)
            if (current === null) return MISSING
            if (current.version !== mutation.expected) return STALE
            const refused = updateStateRefusal(entity, current, mutation.values)
            if (refused !== null) return invalidAt(refused)
        }
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
        const refused = insertStateRefusal(this.engine.definition(mutation.entity), mutation.values)
        if (refused !== null) return invalidAt(refused)
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
        // Linking TO a deleted record is refused as FROM one is (the source read above found none): `missing`. Unlinking stays allowed.
        if (change === linkRecords && !(await linkTargetIsLive(inner, this.engine.catalog, { entity: mutation.entity, relation: mutation.relation, toId: mutation.to })))
            return MISSING
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
                work(
                    mintScopedTx({
                        manager,
                        workspaceId: tx.workspaceId,
                        ...(tx.agent === undefined ? {} : { agent: tx.agent }),
                    }),
                ),
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
