import { unstable_rethrow } from "next/navigation"
import { TeamForbidden, TeamPage } from "@/features/team"
import { loadTeam } from "@/features/team/queries"
import { getCurrentMember, isManagerRole } from "@/lib/members"

/** Team ("Đội ngũ"): members, roles and invitations. Owner and manager only; staff see a friendly 403. A failed load reaches error.tsx (STATE-8 case-4). */
const Page = async () => {
  const me = await getCurrentMember()
  if (!isManagerRole(me.role)) return <TeamForbidden />
  try {
    return <TeamPage data={await loadTeam()} />
  } catch (error) {
    unstable_rethrow(error) // Next signals (redirect, notFound, dynamic usage) pass through unlogged
    console.error("[team] load failed", error)
    throw error
  }
}

export default Page
