import { ConnectionsView } from "@/features/connections/ConnectionsView"

/** STATE-8: the Connections page itself, with no data yet - heading and tab labels real, the connection lists as skeletons. */
const ConnectionsLoading = () => <ConnectionsView isLoading items={[]} agentNames={{}} agents={[]} localOnly={false} ownerEmail="" />

export default ConnectionsLoading
