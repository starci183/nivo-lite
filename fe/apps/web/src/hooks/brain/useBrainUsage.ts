import { useUsageView } from "@/hooks/knowledge"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"

/** The meter of the workspace's raw document allowance, worded in the viewer's language; undefined until the usage is known. */
export const useBrainUsage = () => {
    const { data } = useQueryKnowledgeUsageSwr()
    return useUsageView(data)
}
