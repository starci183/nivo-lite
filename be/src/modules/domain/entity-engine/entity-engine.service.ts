import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { deriveStateKey, eachInOrder } from "@modules/platform/primitives"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type {
    AggregateRow,
    KeysetPosition,
    ListPage,
    ListedRecord,
    OptionalRecordRow,
    RecordRow,
} from "@nivo-lite/agent-sdk/entity/port"
import { queryProblems, type Aggregate, type Query } from "@nivo-lite/agent-sdk/query"
import { readCursor, signCursor } from "./cursor.policy"
import { EngineFailureService } from "./engine-failure.service"
import { InjectEntityEngineOptions, InjectRecordContacts } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import type { ScopedWork } from "./entity-engine.contracts"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { fileKeysOfAgent } from "./policies/agent-records.policy"
import { aggregateRecords } from "./policies/aggregate-records.policy"
import { contactFilterOf, contactFilterValuesOf } from "./policies/contact-values.policy"
import type { EntityCatalog } from "./policies/compiler.contracts"
import { getRecord } from "./policies/get-record.policy"
import { includeRecords } from "./policies/include-records.policy"
import { listRecords } from "./policies/list-records.policy"
import { mintScopedTx } from "./policies/scoped-tx.policy"
import type { AgentScope, ScopedTx } from "./policies/scoped-tx.contracts"
import type { RecordContactsPort } from "./record-contacts.port"

/** What an agent's deletion takes with it: its records by declared type (a type with none is left out) and the files they hold. */
export interface AgentFootprint {
    /** The record types the agent owns records of, with how many (most first). */
    readonly types: ReadonlyArray<{ readonly type: string; readonly count: number }>
    /** Every record of the agent. */
    readonly records: number
    /** Every file the records hold (a list file field counts each reference). */
    readonly files: number
}

/** The label the cursor signing key is derived under. */
const CURSOR_KEY_LABEL = "entity-engine.cursor"

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu

@Injectable()
/**
 * The generic entity engine over `records`, its scope and its reads. `scoped` is the only way in: it opens one transaction whose first
 * statement enters the workspace scope (row-level security for the `app_engine` role), and every other method takes the `ScopedTx` it
 * hands out. Trees are validated against the catalog first (`queryProblems`), compiled by the compiler policies, and a database failure
 * becomes an `EntityEngineError` (`EngineFailureService`). The writes are `EntityMutationService`.
 */
export class EntityEngineService {
    /** The entity declarations by name: what every tree is resolved against. */
    readonly catalog: EntityCatalog
    private readonly cursorKey: Buffer

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEntityEngineOptions() options: EntityEngineOptions,
        private readonly failures: EngineFailureService,
        @Optional() @InjectRecordContacts() private readonly contacts?: RecordContactsPort,
    ) {
        this.catalog = new Map(options.entities.map((entity) => [entity.name, entity]))
        const key = deriveStateKey(options.cursorKey.reveal(), CURSOR_KEY_LABEL)
        if (key === null) throw new EntityEngineError({ code: EntityEngineErrorCode.CursorKeyInvalid })
        this.cursorKey = key
    }

    /**
     * Runs `work` in one transaction scoped to `workspaceId`: the first statement is `public.engine_scope_enter`, so every later
     * statement sees only that workspace's rows. The scope is entered once per transaction and never re-entered for another workspace.
     * `agent` names the agent the work acts for: the records it inserts are stamped with it, and with `sees: "own"` only its own are reached.
     */
    async scoped<T>(workspaceId: string, work: ScopedWork<T>, agent?: AgentScope): Promise<T> {
        if (!UUID.test(workspaceId))
            throw new EntityEngineError({ code: EntityEngineErrorCode.ScopeInvalid, params: { workspaceId } })
        return await this.entityManager.transaction(async (manager) => {
            await callDbFunction(manager, "public.engine_scope_enter", [workspaceId])
            return work(mintScopedTx({ manager, workspaceId, ...(agent === undefined ? {} : { agent }) }))
        })
    }

    /**
     * Runs `work` in the scope of `workspaceId` on the caller's own transaction `manager`, then leaves the scope (`engine_scope_leave`:
     * the session role and an empty workspace) even when `work` throws, so the caller's other statements keep their grants. Only for a
     * transaction that must stay the caller's, such as the one that writes a work item and its wait together.
     */
    async within<T>(manager: EntityManager, workspaceId: string, work: ScopedWork<T>): Promise<T> {
        if (!UUID.test(workspaceId))
            throw new EntityEngineError({ code: EntityEngineErrorCode.ScopeInvalid, params: { workspaceId } })
        await callDbFunction(manager, "public.engine_scope_enter", [workspaceId])
        try {
            return await work(mintScopedTx({ manager, workspaceId }))
        } finally {
            await callDbFunction(manager, "public.engine_scope_leave", [])
        }
    }

    /** The declaration of an entity, or the engine error of a name the catalog does not hold. */
    definition(name: string): EntityDefinition {
        const entity = this.catalog.get(name)
        if (entity === undefined)
            throw new EntityEngineError({ code: EntityEngineErrorCode.EntityUnknown, params: { name } })
        return entity
    }

    /** One record of the scope's workspace, or null. */
    async get(tx: ScopedTx, entity: string, id: string): Promise<OptionalRecordRow> {
        return await this.failures.reading(entity, () => getRecord(tx, this.definition(entity).name, id))
    }

    /**
     * One page of a query. `scope` binds the cursor to its list (`cursorScopeOf`): a cursor minted for another list, or forged, is
     * refused. Rows carry their toOne joins and the toMany records included for them (one extra statement per include).
     */
    async list(tx: ScopedTx, asked: Query, scope: string): Promise<ListPage> {
        this.assertQuery(asked)
        const query = await this.followingMerges(tx.workspaceId, asked)
        const after = query.page.after === undefined ? null : this.positionOf(query.page.after, scope)
        const found = await this.failures.reading(query.from, () => listRecords(tx, this.catalog, { query, after }))
        const page = found.slice(0, query.page.size)
        const included = await this.failures.reading(query.from, () => this.includedOf(tx, query, page))
        return {
            rows: page.map((row) => ({ ...row, included: included.get(row.row.id) ?? {} })),
            next: found.length > query.page.size ? this.cursorAfter(page, scope) : null,
        }
    }

    /**
     * What dies with the agent: its records counted per declared type by the engine's own aggregate in the agent's own scope (no other
     * agent's record is reached), and the files they hold (read only for a type that declares a file field and has a record). One transaction.
     */
    async footprintOf(workspaceId: string, agentId: string): Promise<AgentFootprint> {
        return await this.scoped(
            workspaceId,
            async (tx): Promise<AgentFootprint> => {
                const types: Array<{ type: string; count: number }> = []
                let files = 0
                await eachInOrder([...this.catalog.values()], async (entity) => {
                    const [row] = await this.aggregate(tx, { from: entity.name, measures: { records: { kind: "count" } }, limit: 1 })
                    const count = row?.measures.records ?? 0
                    if (typeof count !== "number" || count === 0) return
                    types.push({ type: entity.name, count })
                    files += (await fileKeysOfAgent(tx, entity, agentId)).length
                })
                return {
                    types: [...types].sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
                    records: types.reduce((sum, item) => sum + item.count, 0),
                    files,
                }
            },
            { id: agentId, sees: "own" },
        )
    }

    /** The groups and measures of an aggregate. */
    async aggregate(tx: ScopedTx, asked: Aggregate): Promise<ReadonlyArray<AggregateRow>> {
        this.assertQuery(asked)
        const aggregate = await this.followingMerges(tx.workspaceId, asked)
        return await this.failures.reading(aggregate.from, () => aggregateRecords(tx, this.catalog, aggregate))
    }

    /**
     * The tree with every filter on a contact field widened to the ids merged into that contact (the contacts port's aliases): a record
     * keeps the contact id it was written with, and a merge is followed at read time, never by rewriting rows. Unchanged when the tree
     * filters no contact field or no contacts port is bound.
     */
    private async followingMerges<T extends Query | Aggregate>(workspaceId: string, tree: T): Promise<T> {
        const entity = this.catalog.get(tree.from)
        const { where } = tree
        if (entity === undefined || where === undefined || this.contacts === undefined) return tree
        const ids = [...new Set(contactFilterValuesOf(entity, where))]
        if (ids.length === 0) return tree
        const aliases = await this.contacts.aliasesOf(workspaceId, ids)
        return { ...tree, where: contactFilterOf(entity, where, aliases) }
    }

    private assertQuery(tree: Query | Aggregate): void {
        const [first] = queryProblems(tree, this.catalog)
        if (first !== undefined)
            throw new EntityEngineError({
                code: EntityEngineErrorCode.QueryInvalid,
                params: { problem: first.code, at: first.at, entity: tree.from },
            })
    }

    private positionOf(cursor: string, scope: string): KeysetPosition {
        const position = readCursor(this.cursorKey, scope, cursor)
        if (position === null) throw new EntityEngineError({ code: EntityEngineErrorCode.CursorInvalid })
        return position
    }

    /** The cursor of the page after the last row of `page` (a page holds a row whenever a further one exists, so the join yields one cursor). */
    private cursorAfter(page: ReadonlyArray<ListedRecord>, scope: string): string {
        return page
            .slice(-1)
            .map((row) => signCursor(this.cursorKey, scope, row.position))
            .join("")
    }

    private async includedOf(
        tx: ScopedTx,
        query: Query,
        page: ReadonlyArray<ListedRecord>,
    ): Promise<ReadonlyMap<string, Readonly<Record<string, ReadonlyArray<RecordRow>>>>> {
        const parentIds = page.map((row) => row.row.id)
        const byParent = new Map<string, Readonly<Record<string, ReadonlyArray<RecordRow>>>>()
        await eachInOrder(query.include ?? [], async (spec) => {
            const found = await includeRecords(tx, this.catalog, query.from, spec, parentIds)
            found.forEach((rows, parent) => byParent.set(parent, { ...byParent.get(parent), [spec.relation]: rows }))
        })
        return byParent
    }
}
