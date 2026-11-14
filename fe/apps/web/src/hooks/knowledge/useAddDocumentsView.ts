"use client"

import { useFormatter, useTranslations } from "next-intl"
import { navigation } from "@/modules/i18n"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import { useQueryKnowledgeUsageSwr } from "@/hooks/swr"
import { buildAddDocumentsView, type ZoneView, type AddDocumentsViewInput } from "./knowledge.shared"
import { useAddDocuments } from "./useAddDocuments"
import { useAddDropZone } from "./useAddDropZone"
import { useAddInstances } from "./useAddInstances"
import { useQueueActions } from "./useQueueActions"
import { useUsageView } from "./useUsageView"
import type { UsageView } from "@/modules/documents"
import type {
    AddMode,
    BatchOptions,
    FaqEntry,
    LinkRows,
    NoteDraft,
    QueuedDoc,
    AddQueue,
} from "@/hooks/knowledgeAddTypes"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The view `useAddDocumentsView` returns. */
export interface AddDocumentsViewShape {
    add: {
        queue: AddQueue
        linkRows: LinkRows
        note: NoteDraft
        options: BatchOptions
        mode: AddMode
        isBusy: boolean
        failure: string | null
        queuedCount: number
        queuedDocs: readonly QueuedDoc[]
        pendingCount: number
        hasFailed: boolean
        isDone: boolean
        noteBody: string
        pickMode: (key: string) => void
        submit: () => undefined
        retryItem: (id: string) => undefined
        close: () => void
    }
    view: {
        readonly zone: ZoneView
        readonly usage: UsageView | undefined
        readonly title: string
        readonly submitLabel: string
        readonly failTitle: string
        readonly readOnlyNote: string | undefined
        readonly isBusy: boolean
        readonly modeLabel: string
        readonly modeOptions: {
            id: AddMode
            label: string
        }[]
        readonly mode: AddMode
        readonly files: {
            readonly dropPrompt: string
            readonly dropHint: string
            readonly linksLabel: string
            readonly linksHint: string
            readonly linkPlaceholder: string
            readonly linkRemoveLabel: string
            readonly addLinkLabel: string
            readonly queueTitle: string
            readonly removeLabel: string
            readonly links: {
                id: string
                label: string
                value: string
                error: string | undefined
            }[]
            readonly queue: {
                id: string
                name: string
                detail: string
                statusLabel: string
                statusTone: "success" | "neutral" | "danger" | "warning"
                error: string | undefined
                canRemove: boolean
                retryLabel: string | undefined
            }[]
            readonly batch:
                | {
                      label: string
                      value: number
                      valueText: string
                  }
                | undefined
            readonly stopped:
                | {
                      text: string
                      dismissLabel: string
                      pickLabel: string
                  }
                | undefined
            readonly note: string | undefined
        }
        readonly note: {
            readonly titleLabel: string
            readonly titleHint: string
            readonly contentLabel: string
            readonly contentHint: string
            readonly questionLabel: string
            readonly answerLabel: string
            readonly addLabel: string
            readonly removeLabel: string
            readonly title: string
            readonly content: string
            readonly pairs: readonly FaqEntry[] | undefined
            readonly titleError: string | undefined
            readonly contentError: string | undefined
        }
        readonly internalNote: string
        readonly options: {
            readonly title: string
            readonly topicLabel: string
            readonly topicHint: string
            readonly tagsLabel: string
            readonly tagsHint: string
            readonly moduleLabel: string
            readonly topic: string
            readonly tags: string
            readonly module: string
            readonly moduleOptions: readonly [
                {
                    readonly id: "all"
                    readonly label: string
                },
                ...(
                    | {
                          id:
                              | "content"
                              | "chatbot"
                              | "lead_gen"
                              | "sales"
                              | "booking"
                              | "video"
                              | "hiring"
                          label: string
                      }
                    | {
                          id: string
                          label: string
                      }
                )[],
            ]
        }
        readonly notice: string | undefined
        readonly error: string | undefined
    }
}

/**
 * The form that adds documents, as the connected block draws it: files and links, a written note or questions, who may read them,
 * and Google Drive granted from beside the files.
 */
export const useAddDocumentsView = (props: AddDocumentsViewInput): AddDocumentsViewShape => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("knowledge")
    const formatter = useFormatter()
    const { data: usage } = useQueryKnowledgeUsageSwr()
    const usageView = useUsageView(usage?.documents)
    const router = navigation.useRouter()
    const actions = useQueueActions()
    const { canWrite, instances } = useAddInstances()
    const moduleParam = props.module === "all" ? undefined : props.module
    const sourcesHref = () => workspaceHref(workspaceId, brainTabHref("sources", { module: moduleParam }))
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
