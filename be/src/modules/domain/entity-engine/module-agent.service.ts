import { Injectable } from "@nestjs/common"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import type { AgentScope } from "./policies/scoped-tx.contracts"

@Injectable()
/**
 * The agent a write for a module belongs to. Records are agent-only: a record written by a module's job, seed or workbench action is
 * the record of that module's installed agent in the workspace, so the scope the writer opens carries it (`EntityEngineService.scoped`,
 * third argument) and the engine stamps it. This is the one derivation of that agent; no writer reads the installations itself. A
 * module with no installed agent in the workspace gets a refusal (`AgentMissing`), never a record without an agent.
 */
export class ModuleAgentService {
    constructor(private readonly installations: InstallationRecordsService) {}

    /**
     * The scope for a write of `moduleKey` in the workspace. With `installationId` (a screen that opened one installation of a module
     * that may be installed twice) the agent is that installation's, which must belong to the workspace and the module; without it,
     * the agent of the module's oldest installation. The scope sees every record of the workspace (`all`): the writer's rights, not
     * the agent boundary, decide what it may read.
     */
    async scopeOf(workspaceId: string, moduleKey: string, installationId?: string): Promise<AgentScope> {
        const installation =
            installationId === undefined
                ? await this.installations.firstOfModule(workspaceId, moduleKey)
                : await this.installations.find(workspaceId, installationId)
        if (
            installation?.moduleKey !== moduleKey ||
            installation.status === "removed" ||
            installation.agentId === null
        )
            throw new EntityEngineError({
                code: EntityEngineErrorCode.AgentMissing,
                params: { module: moduleKey, workspaceId },
            })
        return { id: installation.agentId, sees: "all" }
    }
}
