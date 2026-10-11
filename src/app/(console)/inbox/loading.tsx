import { InboxView } from "@/features/inbox/view"

/** STATE-8: the Inbox page itself, with no data yet - the same heading, notice, bank card and simulator, the feed as three skeleton rows. */
const InboxLoading = () => <InboxView isLoading events={[]} nowIso="" initialEventId="" />

export default InboxLoading
