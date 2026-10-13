import type { OverviewSnapshot } from "@modules/domain/overview"
import type { DashboardType } from "./dto/dashboard.type"

/** Maps the dashboard snapshot to the GraphQL type: the shapes are the same, so the fields are handed over as they are. */
export const toDashboardType = (snapshot: OverviewSnapshot): DashboardType => ({ ...snapshot })
