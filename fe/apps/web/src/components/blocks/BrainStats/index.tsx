"use client"

import { useTranslations } from "next-intl"
import { useBrainCommand } from "@/hooks/brain"
import type { BrainFigures } from "@/hooks/brain"
import { useKnowledgeRealtime } from "@/hooks/knowledge"
import type { CommandActions } from "@/hooks/knowledge"
import { writeCommandWait } from "@/modules/db/knowledge/write-command-wait"
import { writeCommand } from "@/modules/db/knowledge/write-command"
import { navigation } from "@/modules/i18n"
import { BrainStatsBase } from "./component"

/** Props for the connected Second Brain figures. */
interface BrainStatsProps {
    readonly workspaceId: string
    readonly figures: BrainFigures
    /** Whether a scheduled value is due or a value in force has ended, and the person may bring the brain up to date. */
    readonly isMaintenanceDue: boolean
    /** True while the page loads: the labels stay and the values are skeletons. */
    readonly isLoading?: boolean
}

const ACTIONS: CommandActions = { write: writeCommand, wait: writeCommandWait }

/** The connected Second Brain figures: follows the workers live and offers to bring the brain up to date when something is due. */
export const BrainStats = (props: BrainStatsProps) => {
    const t = useTranslations("brain")
    const router = navigation.useRouter()
    const command = useBrainCommand(props.workspaceId, ACTIONS)
    useKnowledgeRealtime(
        props.workspaceId,
        ["knowledge_sources", "brain_facts", "brain_lessons", "knowledge_gaps", "brain_extractions"],
        () => router.refresh(),
    )
    const { figures } = props
    return (
        <BrainStatsBase
            props={{
                label: t("statsLabel"),
                isSkeleton: props.isLoading ?? false,
                figures: [
                    {
                        id: "docs",
                        term: t("statDocs"),
                        value: String(figures.documents),
                        meta: t("statDocsMeta", { n: figures.indexing }),
                    },
                    {
                        id: "facts",
                        term: t("statFacts"),
                        value: String(figures.facts),
                        meta: t("statFactsMeta", { n: figures.scheduled }),
                    },
                    {
                        id: "review",
                        term: t("statReview"),
                        value: String(figures.review),
                        meta: t("statReviewMeta", { n: figures.conflicts }),
                    },
                    {
                        id: "lessons",
                        term: t("statLessons"),
                        value: String(figures.lessons),
                        meta: t("statLessonsMeta", { n: figures.proposedLessons }),
                    },
                    { id: "gaps", term: t("statGaps"), value: String(figures.gaps), meta: t("statGapsMeta") },
                ],
                processing:
                    figures.processing > 0
                        ? { title: t("processingTitle", { count: figures.processing }), body: t("processingBody") }
                        : undefined,
                maintain: props.isMaintenanceDue
                    ? { title: t("maintainTitle"), body: t("maintainBody"), actionLabel: t("maintainAction") }
                    : undefined,
            }}
            on={{ maintain: () => command.send("brain.maintain", {}) }}
        />
    )
}
