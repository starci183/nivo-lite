import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ModuleInstallationEntity } from "./persistence/entities"

/** An installation as the console workspace badges read it. */
export interface InstallationBadgeRow {
    /** The workspace. */
    readonly workspaceId: string
    /** The module installed. */
    readonly moduleKey: string
    /** The installation status. */
    readonly status: string
    /** Whether it runs live. */
    readonly liveEnabled: boolean
}

/** An installation as the console workspace detail reads it. */
export interface InstallationAdminRow {
    /** The installation id. */
    readonly id: string
    /** The module installed. */
    readonly moduleKey: string
    /** The installation status. */
    readonly status: string
    /** The operating mode. */
    readonly operatingMode: string
    /** Whether it runs live. */
    readonly liveEnabled: boolean
    /** The active context version, when one is applied. */
    readonly activeContextVersionId: string | null
    /** The reply processor named in the settings, when one is set. */
    readonly processor: string | null
}

/** The text of the processor setting, or null when it is not text. */
const processorOf = (settings: { readonly processor?: unknown }): string | null =>
    typeof settings.processor === "string" ? settings.processor : null

@Injectable()
/** Installation reads for the platform team console. */
export class ModuleInstallationsAdminReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The installations of every workspace, at most `limit`, for the list badges. */
    async badges(limit: number): Promise<Array<InstallationBadgeRow>> {
        const rows = await this.entityManager.find(ModuleInstallationEntity, {
            select: { workspaceId: true, moduleKey: true, status: true, liveEnabled: true },
            take: limit,
        })
        return rows.map(({ workspaceId, moduleKey, status, liveEnabled }) => ({
            workspaceId,
            moduleKey,
            status,
            liveEnabled,
        }))
    }

    /** The installations of one workspace, at most `limit`. */
    async ofWorkspace(workspaceId: string, limit: number): Promise<Array<InstallationAdminRow>> {
        const rows = await this.entityManager.find(ModuleInstallationEntity, {
            select: {
                id: true,
                moduleKey: true,
                status: true,
                operatingMode: true,
                liveEnabled: true,
                activeContextVersionId: true,
                settings: true,
            },
            where: { workspaceId },
            take: limit,
        })
        return rows.map((row) => ({
            id: row.id,
            moduleKey: row.moduleKey,
            status: row.status,
            operatingMode: row.operatingMode,
            liveEnabled: row.liveEnabled,
            activeContextVersionId: row.activeContextVersionId,
            processor: processorOf(row.settings),
        }))
    }
}
