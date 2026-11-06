import { Injectable } from "@nestjs/common"
import { DEFAULT_TIME_ZONE } from "@nivo-lite/blocks-core/entities"
import { q } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { timeZoneOrDefault } from "./workspace-time-zone.policy"

@Injectable()
/** Reads the declared workspace setting `timeZone` (entity `workspace.settings`, one record per workspace) for the run context of the door. */
export class WorkspaceTimeZoneService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
    ) {}

    /** The IANA time zone of the workspace's day, week and month; the default until the workspace saved one. */
    async timeZoneOf(workspaceId: string): Promise<string> {
        const page = await this.engine.scoped(workspaceId, (tx) =>
            this.ports
                .entitiesApi((use) => use(tx), "action")
                .list({
                    from: "workspace.settings",
                    select: ["timeZone"],
                    where: q.eq("key", "workspace"),
                    order: [
                        ["key", "asc"],
                        ["id", "asc"],
                    ],
                    page: { size: 1 },
                }),
        )
        return timeZoneOrDefault(page.rows[0]?.row.data["timeZone"], DEFAULT_TIME_ZONE)
    }
}
