import { Injectable } from "@nestjs/common"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { EntitiesApi } from "@nivo-lite/agent-sdk/entity/port"

@Injectable()
/** The one door of the chat capability to the engine: work that runs in one transaction scoped to a workspace, over the entity handle. */
export class ChatEntitiesService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
    ) {}

    /** Runs `work` in one scoped transaction; every call on the handle belongs to it, so the writes commit together or not at all. */
    run<T>(workspaceId: string, work: (api: EntitiesApi) => Promise<T>): Promise<T> {
        return this.engine.scoped(workspaceId, (tx) => work(this.ports.entitiesApi((use) => use(tx), "job")))
    }
}
