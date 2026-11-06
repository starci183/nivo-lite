import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"

/** The agent an installation runs, from the graph that holds the installation; null when the workspace has no such installation. */
export const agentOfInstallation = async (graphs: EntityApi, installation: string): Promise<string | null> => {
    const page = await graphs.list({
        select: ["agentId"],
        where: q.eq("installationId", installation),
        order: [["id", "asc"]],
        page: { size: 1 },
    })
    const agent = page.rows[0]?.row.data["agentId"]
    return typeof agent === "string" ? agent : null
}
