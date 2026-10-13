import type { AutomationCard } from "@modules/domain/automations"
import type { AutomationCardType } from "./dto/automation-card.type"

/** Maps one template card to the GraphQL type. */
export const toAutomationCardType = (card: AutomationCard): AutomationCardType => ({
    ...card,
    def: { ...card.def, defaults: { ...card.def.defaults } },
    config: { ...card.config },
})
