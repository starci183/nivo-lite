"use client"

import { useFormatter, useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { brainTabHref } from "@/modules/routes"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import { buildAddDocumentsView } from "./knowledge.shared"
import type { AddDocumentsViewInput } from "./knowledge.shared"
import { useAddDocuments } from "./useAddDocuments"
import { useAddDropZone } from "./useAddDropZone"
import { useAddInstances } from "./useAddInstances"
import { useQueueActions } from "./useQueueActions"
import { useUsageView } from "./useUsageView"

/**
 * The form that adds documents, as the connected block draws it: files and links, a written note or questions, who may read them,
 * and Google Drive granted from beside the files.
 */
export const useAddDocumentsView = (props: AddDocumentsViewInput) => {
    const t = useTranslations("knowledge")
    const formatter = useFormatter()
    const { data: usage } = useQueryKnowledgeUsageSwr()
    const usageView = useUsageView(usage)
    const router = navigation.useRouter()
    const actions = useQueueActions()
    const { canWrite, instances } = useAddInstances()
    const moduleParam = props.module === "all" ? undefined : props.module
    const sourcesHref = () => brainTabHref("sources", { module: moduleParam })
    const add = useAddDocuments({
        actions,
        instances,
        preset: props.preset,
        faqLabels: { question: t("faqQuestionPrefix"), answer: t("faqAnswerPrefix") },
        onAdded: () => undefined,
        onClose: () => router.replace(sourcesHref()),
    })
    const zone = useAddDropZone(sourcesHref)
    return {
        add,
        view: buildAddDocumentsView({ t, formatter, props, add, canWrite, instances, zone, usage: usageView }),
    }
}
