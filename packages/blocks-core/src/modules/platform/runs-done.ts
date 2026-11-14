import type { DashboardRow } from "../../views/views.types"
import type { CoreRun } from "./platform.types"

/**
 * The row of one finished run: the run's trigger is its headline and the instant it ended its detail, as the engine stores them. The
 * words the viewer reads them in are the agent page's to put on (the platform has no wording of its own).
 */
export const doneRowOf = (run: CoreRun): DashboardRow => ({
    id: run.id,
    title: run.trigger,
    description: run.endedAt ?? "",
    href: "",
})
