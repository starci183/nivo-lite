import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { InstallationAgentLink } from "./installation-operations.contracts"
import { ModuleInstallationEntity } from "./persistence/entities"

@Injectable()
/** The installation facts other capabilities ask of a module while they work: how its handling instance runs and which agents serve it. */
export class InstallationOperationsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * How the handling instance of a module runs: the named instance, else the oldest of the module in the workspace; null when
     * the module has no such instance.
     */
    async operatingModeOf(
        workspaceId: string,
        moduleKey: string,
        installationId: string | null,
    ): Promise<string | null> {
        const installed = this.entityManager
            .createQueryBuilder(ModuleInstallationEntity, "i")
            .select("i.operating_mode", "operatingMode")
            .where("i.workspace_id = :workspaceId AND i.module_key = :moduleKey", { workspaceId, moduleKey })
        if (installationId !== null) installed.andWhere("i.id = :installationId", { installationId })
        const row = await installed
            .orderBy("i.created_at", "ASC")
            .addOrderBy("i.id", "ASC")
            .limit(1)
            .getRawOne<{ operatingMode: string }>()
        return row?.operatingMode ?? null
    }

    /** The instances of a module in the workspace with the agent each runs, oldest first, at most `limit`. */
    async agentLinksOf(
        workspaceId: string,
        moduleKey: string,
        limit: number,
    ): Promise<Array<InstallationAgentLink>> {
        const rows = await this.entityManager.find(ModuleInstallationEntity, {
            select: { id: true, agentId: true },
            where: { workspaceId, moduleKey },
            order: { createdAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => ({ id: row.id, agentId: row.agentId }))
    }
}
