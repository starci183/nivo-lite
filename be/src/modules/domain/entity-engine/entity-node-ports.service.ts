import { Injectable } from "@nestjs/common"
import type { NodeQuery, ReadScope } from "@nivo-lite/agent-sdk/node"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { ListPage } from "@nivo-lite/agent-sdk/entity/port"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import { InjectEntityEngineOptions } from "./entity-engine.decorators"
import { EntityEngineService } from "./entity-engine.service"
import type { EntityEngineOptions } from "./entity-engine.options"
import type { EntityNodePort, EntityNodeRows, EntityNodeTurn, NodeReadPlan } from "./entity-node.contracts"
import { NODE_SCAN_PAGES, nodeReadPlanOf, nodeRowOf } from "./entity-node-read.policy"
import type { ScopedTx } from "./policies/scoped-tx.contracts"

@Injectable()
/**
 * The graph node data ports of the engine: one per declared entity, under the entity's `dataKind`. The graph node host registers them
 * in its registry (which refuses a second owner of a kind), so a module that moved onto the engine serves its kind from here and keeps
 * no port of its own. A node query becomes a list query under the workspace scope (equalities, at most 100 rows, newest first), a
 * `turn` read adds the turn's record, and each row is cut to the fields asked. The ports only read; a node writes through its effects.
 */
export class EntityNodePortsService {
    constructor(
        private readonly engine: EntityEngineService,
        @InjectEntityEngineOptions() private readonly options: EntityEngineOptions,
    ) {}

    /** The port of every declared entity. */
    ports(): ReadonlyArray<EntityNodePort> {
        const kinds = new Map<string, string>(this.options.entities.map((entity) => [entity.name, entity.dataKind]))
        const kindOfEntity = (name: string): string | undefined => kinds.get(name)
        return this.options.entities.map((entity): EntityNodePort => ({
            kind: entity.dataKind,
            read: (turn, query, scope) => this.read(entity, kindOfEntity, turn, query, scope),
        }))
    }

    /** The rows the query asks for, cut to its fields; none when a `turn` read has no path to a record of the turn. */
    private async read(
        entity: EntityDefinition,
        kindOfEntity: (name: string) => string | undefined,
        turn: EntityNodeTurn,
        query: NodeQuery,
        scope: ReadScope,
    ): Promise<EntityNodeRows> {
        const plan = nodeReadPlanOf(entity, kindOfEntity, turn, query, scope)
        if (plan === null) return []
        const cursorScope = cursorScopeOf(`node.${entity.dataKind}`, { scope, anchor: plan.anchor }, "newest")
        return await this.engine.scoped(turn.workspaceId, (tx) =>
            this.collect(tx, plan, cursorScope, query.fields, undefined, [], NODE_SCAN_PAGES),
        )
    }

    /** The kept rows of this page and the pages after it: one page without a join, up to `pagesLeft` pages while records linked to the turn's are kept. */
    private async collect(
        tx: ScopedTx,
        plan: NodeReadPlan,
        cursorScope: string,
        fields: ReadonlyArray<string>,
        after: string | undefined,
        kept: EntityNodeRows,
        pagesLeft: number,
    ): Promise<EntityNodeRows> {
        const page = await this.engine.list(
            tx,
            after === undefined ? plan.query : { ...plan.query, page: { ...plan.query.page, after } },
            cursorScope,
        )
        const rows = [...kept, ...this.keptOf(plan, page, fields)].slice(0, plan.limit)
        if (plan.via === null || rows.length >= plan.limit || page.next === null || pagesLeft <= 1) return rows
        return await this.collect(tx, plan, cursorScope, fields, page.next, rows, pagesLeft - 1)
    }

    private keptOf(plan: NodeReadPlan, page: ListPage, fields: ReadonlyArray<string>): EntityNodeRows {
        const { via } = plan
        return page.rows
            .filter((listed) => via === null || listed.joined[via]?.id === plan.anchor)
            .map((listed) => nodeRowOf(listed.row, fields))
    }
}
