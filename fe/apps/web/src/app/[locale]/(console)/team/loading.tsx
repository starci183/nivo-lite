import { TeamView } from "@/features/team/view"

/** STATE-8: the Team page itself, with no data yet - the same sections and labels, members and invitations as skeleton rows. */
const TeamLoading = () => <TeamView isLoading data={null} />

export default TeamLoading
