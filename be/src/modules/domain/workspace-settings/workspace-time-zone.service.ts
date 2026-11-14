import { Injectable } from "@nestjs/common"
import { DEFAULT_TIME_ZONE } from "@nivo-lite/agent-sdk/port"
import type { EntityManager } from "typeorm"
import type { WorkspaceFacts } from "@nivo-lite/agent-sdk/template"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { timeZoneOrDefault } from "./workspace-time-zone.policy"

@Injectable()
/**
 * Reads the `time_zone` of the core `workspaces` row: the ONE reader every production decision of a day, a week or a month goes through.
 * It reads that one column only (it runs on every turn), so it is the light face of `WorkspaceSettingsService`; it needs the primary
 * connection and nothing else, so an app that registers no workspaces capability (the cli, mcp) reads it too.
 */
export class WorkspaceTimeZoneService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The IANA time zone of the workspace's day, week and month; the default for a workspace the core does not know. */
    async timeZoneOf(workspaceId: string): Promise<string> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { id: true, timeZone: true },
            where: { id: workspaceId },
        })
        return timeZoneOrDefault(row?.timeZone, DEFAULT_TIME_ZONE)
    }

    /**
     * The workspace's own facts a template node reads (`ctx.workspace`), in one read of its row: the time zone (the default for a workspace
     * the core does not know), the name it shows (its brand name when one is saved, else its name; empty for an unknown workspace) and its
     * logo's address when one is saved. The workspace has no language setting, so none is answered.
     */
    async factsOf(workspaceId: string): Promise<WorkspaceFacts> {
        const row = await this.entityManager.findOne(WorkspaceEntity, {
            select: { id: true, name: true, displayName: true, timeZone: true, logoUrl: true },
            where: { id: workspaceId },
        })
        const brand = row?.displayName?.trim() ?? ""
        const logo = row?.logoUrl ?? null
        return {
            timeZone: timeZoneOrDefault(row?.timeZone, DEFAULT_TIME_ZONE),
            name: brand === "" ? (row?.name ?? "") : brand,
            ...(logo === null || logo === "" ? {} : { logo }),
        }
    }
}
