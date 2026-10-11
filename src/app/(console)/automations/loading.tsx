import { AutomationsView } from "@/features/automations/view"

/** STATE-8: the Automations page itself, with no data yet - the same heading, filters and links, the cards as three skeleton cards. */
const AutomationsLoading = () => <AutomationsView isLoading data={{ cards: [], runs: [], shop: { shop: "", hours: "", tone: "" } }} />

export default AutomationsLoading
