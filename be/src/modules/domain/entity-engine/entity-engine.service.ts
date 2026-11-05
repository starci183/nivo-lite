import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { deriveStateKey, eachInOrder } from "@modules/platform/primitives"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { Aggregate, Query } from "@nivo-lite/agent-sdk/query"
import { readCursor, signCursor } from "./cursor.policy"
import { EngineFailureService } from "./engine-failure.service"
import { InjectEntityEngineOptions } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import type { ListPage, OptionalRecordRow, ScopedWork } from "./entity-engine.contracts"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { aggregateRecords } from "./policies/aggregate-records.policy"
import type { AggregateRow } from "./policies/aggregate-records.policy"
import type { EntityCatalog, KeysetPosition, RecordRow } from "./policies/compiler.contracts"
import { getRecord } from "./policies/get-record.policy"
import { includeRecords } from "./policies/include-records.policy"
import { listRecords } from "./policies/list-records.policy"
import type { ListedRecord } from "./policies/list-records.policy"
import { mintScopedTx } from "./policies/scoped-tx.policy"
import type { ScopedTx } from "./policies/scoped-tx.contracts"

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
    ) {
        this.catalog = new Map(options.entities.map((entity) => [entity.name, entity]))
        const key = deriveStateKey(options.cursorKey.reveal(), CURSOR_KEY_LABEL)
        if (key === null) throw new EntityEngineError({ code: EntityEngineErrorCode.CursorKeyInvalid })
        this.cursorKey = key
    }

    /**
     * Runs `work` in one transaction scoped to `workspaceId`: the first statement is `public.engine_scope_enter`, so every later
     * statement sees only that workspace's rows. The scope is entered once per transaction and never re-entered for another workspace.
     */
    async scoped<T>(workspaceId: string, work: ScopedWork<T>): Promise<T> {
        if (!UUID.test(workspaceId))
            throw new EntityEngineError({ code: EntityEngineErrorCode.ScopeInvalid, params: { workspaceId } })
        return await this.entityManager.transaction(async (manager) => {
            await callDbFunction(manager, "public.engine_scope_enter", [workspaceId])
            return work(mintScopedTx(manager, workspaceId))
        })
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
        return await this.failures.reading(() => getRecord(tx, this.definition(entity).name, id))
    }

    /**
     * One page of a query. `scope` binds the cursor to its list (`cursorScopeOf`): a cursor minted for another list, or forged, is
     * refused. Rows carry their toOne joins and the toMany records included for them (one extra statement per include).
     */
    async list(tx: ScopedTx, query: Query, scope: string): Promise<ListPage> {
        this.assertQuery(query)
        const after = query.page.after === undefined ? null : this.positionOf(query.page.after, scope)
        const found = await this.failures.reading(() => listRecords(tx, this.catalog, { query, after }))
        const page = found.slice(0, query.page.size)
        const included = await this.failures.reading(() => this.includedOf(tx, query, page))
        return {
            rows: page.map((row) => ({ ...row, included: included.get(row.row.id) ?? {} })),
            next: found.length > query.page.size ? this.cursorAfter(page, scope) : null,
        }
    }

    /** The groups and measures of an aggregate. */
    async aggregate(tx: ScopedTx, aggregate: Aggregate): Promise<ReadonlyArray<AggregateRow>> {
        this.assertQuery(aggregate)
        return await this.failures.reading(() => aggregateRecords(tx, this.catalog, aggregate))
    }

    private assertQuery(tree: Query | Aggregate): void {
        const [first] = queryProblems(tree, this.catalog)
        if (first !== undefined)
            throw new EntityEngineError({
                code: EntityEngineErrorCode.QueryInvalid,
                params: { problem: first.code, at: first.at },
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
