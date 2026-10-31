import { useLocale, useTranslations } from "next-intl"
import { usageViewOf } from "@/hooks/knowledge"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"

/** The meter of the workspace's raw document allowance, worded in the viewer's language; undefined until the usage is known. */
export const useBrainUsage = () => {
    const knowledge = useTranslations("knowledge")
    const locale = useLocale()
    const { data } = useQueryKnowledgeUsageSwr()
    return usageViewOf(knowledge, locale, data)
}
