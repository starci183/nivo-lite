import { DecisionsView } from "@/features/decisions/component"

/** STATE-8: the decision history itself, with no data yet - the same heading and filters, the list as three skeleton rows. */
const DecisionsLoading = () => <DecisionsView isLoading rows={[]} kind={null} dept={null} limit={100} />

export default DecisionsLoading
