import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { AgentRecordsErasure, AgentRecordsFootprint, AgentRecordsPort } from "@modules/domain/modules"
import type { StorageFilesPort } from "@modules/integrations/object-storage"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectRecordFilesStorage } from "./record-files.decorators"
import { RecordFilesLogEvent } from "./record-files.log-events"

@Injectable()
/**
 * The records of an agent as its removal sees them (`AGENT_RECORDS`): the count of what dies with it (the engine's aggregate in the agent's own
 * scope), the erase of every record of the agent in the removal's own transaction (`EntityMutationService.eraseForAgent`: links first, one
 * transaction with the removal), and, once the removal committed, the removal of those records' files from the one records bucket (files.md: a
 * deleted record leaves no object; a database cascade never removes one). A store that cannot remove an object leaves it and logs, as a replaced
 * file does: the records are already gone.
 */
export class RecordAgentErasureService implements AgentRecordsPort {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
        @InjectRecordFilesStorage() private readonly storage: StorageFilesPort,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The records per type and the files that dying with the agent would take. */
    async footprintOf(workspaceId: string, agentId: string): Promise<AgentRecordsFootprint> {
        return await this.engine.footprintOf(workspaceId, agentId)
    }

    /** Erases every record of the agent in the caller's transaction; answers the file keys for `removeFiles` once it committed. */
    async erase(workspaceId: string, agentId: string, manager: EntityManager): Promise<AgentRecordsErasure> {
        const erased = await this.mutations.eraseForAgent(workspaceId, agentId, manager)
        return { records: erased.erased, files: erased.files }
    }

    /** Removes the objects from the bucket; one the store cannot remove is kept and logged. */
    async removeFiles(keys: ReadonlyArray<string>): Promise<void> {
        await eachInOrder(keys, async (key) => {
            const removed = await this.storage.remove(key)
            if (removed.kind !== "ok") this.logger.warn(RecordFilesLogEvent.ObjectKept, { code: removed.code })
        })
    }
}
