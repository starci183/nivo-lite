import { AccountView } from "@/features/account/component"

/** STATE-8: the account page itself, with no data yet - the same cards and labels, values and device rows as skeletons. */
const AccountLoading = () => <AccountView isLoading name="" email="" providers={[]} sessions={[]} sessionsFailed={false} />

export default AccountLoading
