import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { DashboardRow } from "../../views/views.types"

/**
 * The row of one finished run: the run's trigger is its headline and the instant it ended its detail, as the engine stores them. The
 * words the viewer reads them in are the agent page's to put on (the platform has no wording of its own).
 */
export const doneRowOf = (run: RecordRow): DashboardRow => {
    const trigger = run.data["trigger"]
    const endedAt = run.data["endedAt"]
    return {
        id: run.id,
        title: typeof trigger === "string" ? trigger : "",
        description: typeof endedAt === "string" ? endedAt : "",
        href: "",
    }
}
