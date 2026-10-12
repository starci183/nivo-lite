import { KnowledgeView } from "@/features/knowledge/KnowledgeView"
import { MODULE_KEYS } from "@/lib/modules-shared"

/** STATE-8: the Documents page itself, with no data yet - the same tree, its sources and suggestion rows as skeletons. */
const KnowledgeLoading = () => (
  <KnowledgeView isLoading sources={[]} topics={[]} suggestions={[]} skipped={[]} canWrite={false} workspaceId="" initialModule="all" askModule={MODULE_KEYS[0]} />
)

export default KnowledgeLoading
