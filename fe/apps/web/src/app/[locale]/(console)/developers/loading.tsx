import { DevelopersView } from "@/features/developers/view"

/** STATE-8: the Advanced page itself, with no data yet - the same sections and labels, hooks, keys and examples as skeletons. */
const DevelopersLoading = () => <DevelopersView isLoading hooks={[]} keys={[]} keysError={null} canManage={false} base="" />

export default DevelopersLoading
