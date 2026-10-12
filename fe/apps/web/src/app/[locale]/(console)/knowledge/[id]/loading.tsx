import { SourceDetail } from "@/features/knowledge/SourceDetail"

/** STATE-8: the source page itself, with no data yet - trail and card labels real, title, facts and passages as skeletons. */
const SourceLoading = () => <SourceDetail isLoading source={null} chunks={[]} canWrite={false} />

export default SourceLoading
