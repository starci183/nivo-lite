import { Injectable } from "@nestjs/common"
import { ModuleJobsQueue } from "@modules/queues/module-jobs"
import type { ModuleJobEnqueueOptions, ModuleJobPayload } from "@modules/queues/module-jobs"
import { OUTBOX_PORT_ID } from "@nivo-lite/agent-sdk/mutation"
import type { EntityManager } from "typeorm"
import type { JobRef, Mutation, MutationBy, OutboxApi } from "@nivo-lite/agent-sdk/mutation"
import { ENTITIES_PORT_ID } from "@nivo-lite/agent-sdk/entity/port"
import type { EngineResult, EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"
import type { DeclaredPorts, JobPorts, RunIn } from "./entity-engine.contracts"
import { InjectEntityEngineOptions } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityMutationService } from "./entity-mutation.service"
import { entityApiOf, listScopeOf } from "./entity-port.policy"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { entityOfPortId } from "./port-id.policy"

@Injectable()
/**
 * The providers of the engine's ports: `engine.entities` and `engine.entity.<name>` (get, list, aggregate, insert, update, upsert, ensure,
 * delete, link, unlink over the catalog) and `engine.outbox` (enqueue a declared job through the module-jobs producer in the transaction
 * of the write). A port is bound to a `RunIn`: `use => use(tx)` binds every call to the caller's transaction (a transactional action, a job
 * with no external call); `use => engine.scoped(workspace, use)` gives every call its own (a job that calls the door, since no
 * transaction spans an external call, BE-PERSISTENCE-6). The `door` and `ai` ports are not provided here.
 */
export class EntityPortsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
        private readonly queue: ModuleJobsQueue,
        @InjectEntityEngineOptions() private readonly options: EntityEngineOptions,
    ) {}

    /** The handle of every port in `ports`, by the name the caller gave it; a port the engine does not provide is refused. */
    portsFor(runIn: RunIn, by: MutationBy, ports: DeclaredPorts): JobPorts {
        return Object.fromEntries(
            Object.entries(ports).map(([name, shape]) => [name, this.provide(runIn, by, shape.id)]),
        )
    }

    /** The multi-entity handle over one scope. */
    entitiesApi(runIn: RunIn, by: MutationBy): EntitiesApi {
        const write = (mutation: Mutation): Promise<EngineResult> =>
            runIn((tx) => this.mutations.mutate(tx, mutation, by))
        return {
            get: (entity, id) => runIn((tx) => this.engine.get(tx, entity, id)),
            list: (query) => runIn((tx) => this.engine.list(tx, query, listScopeOf(query))),
            aggregate: (aggregate) => runIn((tx) => this.engine.aggregate(tx, aggregate)),
            insert: (entity, values, links) =>
                write(links === undefined ? { op: "insert", entity, values } : { op: "insert", entity, values, links }),
            update: (entity, key, expected, values) => write({ op: "update", entity, key, expected, values }),
            upsert: (entity, on, values) => write({ op: "upsert", entity, on, values }),
            ensure: (entity, match, values) => write({ op: "ensure", entity, match, values }),
            delete: (entity, key, expected) =>
                write(expected === undefined ? { op: "delete", entity, key } : { op: "delete", entity, key, expected }),
            link: (entity, key, relation, to) => write({ op: "link", entity, key, relation, to }),
            unlink: (entity, key, relation, to) => write({ op: "unlink", entity, key, relation, to }),
        }
    }

    /** The outbox handle over one scope: a declared job is validated, then written to the queue outbox in the scope's transaction. */
    outboxApi(runIn: RunIn): OutboxApi {
        return {
            enqueue: async <I extends JobRef["input"]>(
                job: JobRef<I>,
                input: unknown,
                options?: ModuleJobEnqueueOptions,
            ) => {
                if (!this.options.jobs.some((declared) => declared.name === job.name))
                    throw new EntityEngineError({ code: EntityEngineErrorCode.JobUnknown, params: { job: job.name } })
                const parsed = job.input.safeParse(input)
                if (!parsed.success)
                    throw new EntityEngineError({
                        code: EntityEngineErrorCode.JobInputInvalid,
                        params: { job: job.name },
                    })
                await runIn((tx) =>
                    this.write(tx.manager, { workspaceId: tx.workspaceId, job: job.name, input: parsed.data }, options),
                )
            },
        }
    }

    /** Writes the delivery to the queue outbox in the transaction `manager` belongs to; the job name scopes the caller's dedupe key. */
    private write(
        manager: EntityManager,
        payload: ModuleJobPayload,
        options: ModuleJobEnqueueOptions | undefined,
    ): Promise<void> {
        const dedupeKey = options?.dedupeKey === undefined ? undefined : `${payload.job}:${options.dedupeKey}`
        return this.queue.enqueue(payload, manager, { dedupeKey, delayMs: options?.delayMs })
    }

    private provide(runIn: RunIn, by: MutationBy, id: string): unknown {
        if (id === ENTITIES_PORT_ID) return this.entitiesApi(runIn, by)
        if (id === OUTBOX_PORT_ID) return this.outboxApi(runIn)
        const entity = entityOfPortId(id)
        if (entity === null) throw new EntityEngineError({ code: EntityEngineErrorCode.PortUnprovided, params: { id } })
        return entityApiOf(this.entitiesApi(runIn, by), this.engine.definition(entity).name)
    }
}
