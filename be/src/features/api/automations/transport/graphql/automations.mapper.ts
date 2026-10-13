import type { AutomationsOverview } from "@modules/domain/automations"
import { toAutomationCardType } from "./automation-card.mapper"
import { toAutomationRunTypes } from "./list-automation-runs.mapper"
import type { AutomationsOverviewType } from "./dto/automations-overview.type"

/** Maps the overview of the workspace to the GraphQL type. */
export const toAutomationsOverviewType = (result: AutomationsOverview): AutomationsOverviewType => ({
    cards: result.cards.map(toAutomationCardType),
    runs: toAutomationRunTypes(result.runs),
    shop: { ...result.shop },
    sample: { variables: { ...result.sample.variables }, neutral: { ...result.sample.neutral } },
})
