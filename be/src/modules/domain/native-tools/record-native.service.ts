import { Injectable, Optional } from "@nestjs/common"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import {
    ENTITY_ENGINE_ERROR_KINDS,
    EntityEngineService,
    EntityPortsService,
    type AgentScope,
    type RunIn,
} from "@modules/domain/entity-engine"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import { isDomainError, type ErrorKind } from "@modules/platform/errors"
import { eachInOrder } from "@modules/platform/primitives"
import type { RecordRefusalReason } from "./record-native.contracts"
import { RECORD_TOOL } from "./record-native.names.policy"
import {
    createOf,
    isRecordId,
    linkTargetsOf,
    listPlanOf,
    recordRefusal,
    recordViewOf,
    resultRefusalOf,
    updateOf,
    verbOf,
    writeRefusalOf,
} from "./record-native.policy"
import {
    RECORD_CREATE_INPUT_SCHEMA,
    RECORD_CREATE_SCHEMA,
    RECORD_GET_INPUT_SCHEMA,
    RECORD_GET_SCHEMA,
    RECORD_LIST_INPUT_SCHEMA,
    RECORD_LIST_SCHEMA,
    RECORD_UPDATE_INPUT_SCHEMA,
    RECORD_UPDATE_SCHEMA,
    type RecordCreateArgs,
    type RecordGetArgs,
    type RecordListArgs,
    type RecordUpdateArgs,
} from "./record-native.schema"

/** How the entity engine's codes travel, read by code: an `invalid` one is a call that does not fit the type, never a broken store. */
const ENGINE_KINDS: Readonly<Record<string, ErrorKind>> = ENTITY_ENGINE_ERROR_KINDS

/** True for an entity engine error of kind `invalid` (a forged or foreign cursor, a value off its column): the call's, not the store's. */
const isEngineInvalid = (cause: unknown): boolean =>
    isDomainError(cause) && Object.hasOwn(ENGINE_KINDS, cause.code) && ENGINE_KINDS[cause.code] === "invalid"

/**
 * The generic record tools: named by what they do to the records of a declared record type, never by a module. A write takes its
 * replay key from the gateway's durable receipt (a write of no `ledgered` mark: the same step asking the same call again is answered
 * what it was, never written twice), and the audit line is the gateway's.
 */
export const RECORD_MANIFEST: ToolManifest = {
    key: "record",
    namespace: "nivo.tool.record",
    name: "Records",
    contractVersion: "record-native@1",
    tools: [
        {
            name: "get",
            description:
                "One record of a record type an installed package declares, by its id (a record of any agent of the workspace may be read): its declared fields under `values`, its `version` and times. A record of another workspace, or none, is `not_found`.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: RECORD_GET_INPUT_SCHEMA,
            argumentSchema: RECORD_GET_SCHEMA,
            domain: RECORD_TOOL.get,
            taints: true,
        },
        {
            name: "list",
            description:
                "One page of the workspace's records (any agent's) of a record type an installed package declares, filtered and ordered by its own fields (a declared index must serve them), with `next` to read the page after.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: RECORD_LIST_INPUT_SCHEMA,
            argumentSchema: RECORD_LIST_SCHEMA,
            domain: RECORD_TOOL.list,
            taints: true,
        },
        {
            name: "create",
            description:
                "Creates one record of a record type an installed package declares, from its declared fields; it is yours (the engine stamps your agent) and the type's own declaration checks every value (`invalid_value`). A type that declares toOne relations takes them as `links` (relation name -> the id of one of your own records; a required relation must be given, an id that is not yours is `invalid_value`).",
            scope: "write",
            defaultMode: "auto",
            inputSchema: RECORD_CREATE_INPUT_SCHEMA,
            argumentSchema: RECORD_CREATE_SCHEMA,
            domain: RECORD_TOOL.create,
        },
        {
            name: "update",
            description:
                "Changes the declared fields of one of your own records; the fields left out stay. Give `version` to change it only as you read it (`stale` otherwise).",
            scope: "write",
            defaultMode: "auto",
            inputSchema: RECORD_UPDATE_INPUT_SCHEMA,
            argumentSchema: RECORD_UPDATE_SCHEMA,
            domain: RECORD_TOOL.update,
        },
    ],
}

/** The parts of the store a call runs on. */
interface Store {
    readonly engine: EntityEngineService
    readonly ports: EntityPortsService
}

@Injectable()
/**
 * `nivo.tool.record.get`, `.list`, `.create` and `.update` over EVERY record type an installed package declares with `defineEntity`
 * (a partition of `public.records`), with no code per type (nivo-frame `engineNoBusiness`). It does only: the arguments by the tool's
 * bounded schema and the values by the TYPE'S OWN declaration (`mutationProblems` / `queryProblems` of the SDK, the entity engine's own
 * checks); the workspace the gateway bound from the run, never one an argument names (the engine's scope: another workspace's record is
 * `not_found`); the CALLING AGENT, stamped by the engine on every record a call creates and the only owner of the records a call changes (another
 * agent's record is `not_found` on an update, the same answer as another workspace's); a READ (get, list) reaches every record of the
 * workspace, whichever agent owns it (owner ruling R16). The node's mode, the ledger and the audit
 * are the gateway's. No owner, state, amount or customer of a record
 * is judged: those are the template's own rules. Every expected case is a typed refusal (`RecordRefusalReason`).
 */
export class RecordNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = RECORD_MANIFEST

    constructor(
        @Optional() private readonly engine?: EntityEngineService,
        @Optional() private readonly ports?: EntityPortsService,
    ) {}

    /** Runs one record tool for the workspace the gateway bound, on the records of the agent that calls. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        const verb = verbOf(tool)
        if (verb === null) throw unknownTool(tool)
        const store = this.storeOf()
        // A write is confined to the calling agent's own records; a read reaches every record of the workspace (R16).
        const agent: AgentScope = { id: caller.agentId, sees: "own" }
        const reader: AgentScope = { id: caller.agentId, sees: "all" }
        if (verb === "get") {
            const asked = argumentsOf(tool, RECORD_GET_SCHEMA, args)
            this.declared(store, asked.type)
            return this.got(store, workspaceId, reader, asked)
        }
        if (verb === "list") {
            const asked = argumentsOf(tool, RECORD_LIST_SCHEMA, args)
            return this.listed(store, workspaceId, reader, asked, this.declared(store, asked.type))
        }
        if (verb === "create") {
            const asked = argumentsOf(tool, RECORD_CREATE_SCHEMA, args)
            return this.created(store, workspaceId, agent, asked, this.declared(store, asked.type))
        }
        const asked = argumentsOf(tool, RECORD_UPDATE_SCHEMA, args)
        return this.updated(store, workspaceId, agent, asked, this.declared(store, asked.type))
    }

    /** The store, or `not_served` in an app that binds no entity engine. */
    private storeOf(): Store {
        const { engine, ports } = this
        if (engine === undefined || ports === undefined) throw recordRefusal("not_served")
        return { engine, ports }
    }

    /** The declaration of the type the call names, or `type_unknown` for a type no installed package declares. */
    private declared(store: Store, type: string): EntityDefinition {
        const definition = store.engine.catalog.get(type)
        if (definition === undefined) throw recordRefusal("type_unknown")
        return definition
    }

    /** Runs `work` on the records of the agent in the workspace, in one transaction scoped to both, as an action writes. */
    private scoped<T>(
        store: Store,
        workspaceId: string,
        agent: AgentScope,
        work: (records: EntitiesApi) => Promise<T>,
    ): Promise<T> {
        return store.engine.scoped(
            workspaceId,
            (tx) => {
                const runIn: RunIn = (use) => use(tx)
                return work(store.ports.entitiesApi(runIn, "action"))
            },
            agent,
        )
    }

    /** Runs `work`, refusing with `reason` a call the entity engine found does not fit the type. */
    private async fitted<T>(reason: RecordRefusalReason, work: () => Promise<T>): Promise<T> {
        try {
            return await work()
        } catch (cause) {
            if (isEngineInvalid(cause)) throw recordRefusal(reason, cause)
            throw cause
        }
    }

    private async got(store: Store, workspaceId: string, agent: AgentScope, asked: RecordGetArgs): Promise<ToolJson> {
        if (!isRecordId(asked.id)) throw recordRefusal("not_found")
        const row = await this.scoped(store, workspaceId, agent, (records) => records.get(asked.type, asked.id))
        if (row === null) throw recordRefusal("not_found")
        return { record: recordViewOf(row) }
    }

    private async listed(
        store: Store,
        workspaceId: string,
        agent: AgentScope,
        asked: RecordListArgs,
        definition: EntityDefinition,
    ): Promise<ToolJson> {
        const plan = listPlanOf(definition, asked)
        if (plan.kind === "refused") throw recordRefusal(plan.reason)
        const page = await this.fitted("query_invalid", () =>
            this.scoped(store, workspaceId, agent, (records) => records.list(plan.query)),
        )
        return { records: page.rows.map((row) => recordViewOf(row.row)), next: page.next }
    }

    private async created(
        store: Store,
        workspaceId: string,
        agent: AgentScope,
        asked: RecordCreateArgs,
        definition: EntityDefinition,
    ): Promise<ToolJson> {
        const refused = writeRefusalOf(definition, createOf(asked.type, asked.values, asked.links))
        if (refused !== null) throw recordRefusal(refused)
        const result = await this.fitted("invalid_value", () =>
            this.scoped(store, workspaceId, agent, async (records) => {
                // A link points at a record of the caller's OWN (the scope hides every other agent's record): any other id is `invalid_value` (the create refuses only what its type declares: `type_unknown`, `invalid_value`, `taken`).
                await eachInOrder(linkTargetsOf(definition, asked.links ?? {}), async ({ target, id }) => {
                    if ((await records.get(target, id)) === null) throw recordRefusal("invalid_value")
                })
                return asked.links === undefined
                    ? records.insert(asked.type, asked.values)
                    : records.insert(asked.type, asked.values, asked.links)
            }),
        )
        if (!result.ok) throw recordRefusal(resultRefusalOf(result) ?? "invalid_value")
        return { record: recordViewOf(result.row) }
    }

    private async updated(
        store: Store,
        workspaceId: string,
        agent: AgentScope,
        asked: RecordUpdateArgs,
        definition: EntityDefinition,
    ): Promise<ToolJson> {
        if (!isRecordId(asked.id)) throw recordRefusal("not_found")
        const result = await this.fitted("invalid_value", () =>
            this.scoped(store, workspaceId, agent, async (records) => {
                const current = await records.get(asked.type, asked.id)
                if (current === null) throw recordRefusal("not_found")
                const expected = asked.version ?? current.version
                const refused = writeRefusalOf(definition, updateOf(asked.type, asked.id, expected, asked.patch))
                if (refused !== null) throw recordRefusal(refused)
                return records.update(asked.type, asked.id, expected, asked.patch)
            }),
        )
        if (!result.ok) throw recordRefusal(resultRefusalOf(result) ?? "invalid_value")
        return { record: recordViewOf(result.row) }
    }
}
