import { unstable_rethrow } from "next/navigation"
import { AuthorityPage } from "@/features/authority"
import { getAuthority, listRules, listStaff } from "@/lib/flow-queries"

/** Authority ("Giao quyền"): goals, policies, automation scope, limits and optional staff. A failed load reaches error.tsx (STATE-8 case-4). */
const Page = async () => {
  try {
    const [authority, rules, staff] = await Promise.all([getAuthority(), listRules(), listStaff()])
    return <AuthorityPage authority={authority} rules={rules} staff={staff} />
  } catch (error) {
    unstable_rethrow(error) // Next signals (redirect, notFound, dynamic usage) pass through unlogged
    console.error("[authority] load failed", error)
    throw error
  }
}

export default Page
