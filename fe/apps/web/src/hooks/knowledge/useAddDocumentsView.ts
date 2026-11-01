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
 * The drop zone and the drawer that adds documents, as the connected block draws them: the drawer opens and closes through
 * the address, the zone opens it on files and links or on a written note, and Google Drive is granted from the zone.
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
    const sourcesHref = (addKey?: string) => brainTabHref("sources", { module: moduleParam, add: addKey })
    const add = useAddDocuments({
        actions,
        instances,
        preset: props.preset,
        faqLabels: { question: t("faqQuestionPrefix"), answer: t("faqAnswerPrefix") },
        onAdded: () => undefined,
        onClose: () => router.replace(sourcesHref()),
    })
    const open = (mode: "files" | "write") => {
        add.pickMode(mode)
        router.push(sourcesHref("files"))
    }
    const zone = useAddDropZone(open, sourcesHref)
    return {
        add,
        open,
        view: buildAddDocumentsView({ t, formatter, props, add, canWrite, instances, zone, usage: usageView }),
    }
}
