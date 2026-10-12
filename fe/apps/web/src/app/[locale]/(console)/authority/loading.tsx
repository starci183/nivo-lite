import { AuthorityView } from "@/features/authority/view"

/** STATE-8: the Authority page itself, with no data yet - the same cards and labels, values and staff rows as skeletons. */
const AuthorityLoading = () => <AuthorityView isLoading authority={null} rules={[]} staff={[]} canEdit linkedStaffIds={[]} />

export default AuthorityLoading
