"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useBrainCommand } from "@/hooks/brain"
import type { CommandActions } from "@/hooks/knowledge"
import { writeCommandWait } from "@/modules/db/knowledge/write-command-wait"
import { writeCommand } from "@/modules/db/knowledge/write-command"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import type { BrainGap } from "@/modules/types"
import { BrainGapsBase } from "./component"

/** Props for the connected unanswered questions. */
interface BrainGapsProps {
    readonly workspaceId: string
    readonly gaps: ReadonlyArray<BrainGap>
    /** True while the page loads: the heading stays and the list is skeleton rows. */
    readonly isLoading?: boolean
}

const ACTIONS: CommandActions = { write: writeCommand, wait: writeCommandWait }

/** The connected unanswered questions: opens the fact form through the address, or dismisses a question. */
export const BrainGaps = (props: BrainGapsProps) => {
    const t = useTranslations("brain")
    const format = useFormatter()
    const command = useBrainCommand(props.workspaceId, ACTIONS)
    const note = command.note
    const rowOf = (gap: BrainGap): KnowledgeRowView => {
        const when = format.dateTime(new Date(gap.lastSeenAt), { dateStyle: "medium" })
        return {
            id: gap.id,
            title: gap.question,
            lines: [gap.count > 1 ? t("gapAsked", { n: gap.count, when }) : t("gapAskedOnce", { when })],
            badges: [
                { label: gap.module, tone: "neutral" },
                ...(gap.reopenedCount > 0 ? [{ label: t("gapReopened"), tone: "warning" as const }] : []),
            ],
            actions: [
                { id: "answer", label: t("gapAnswer"), href: `${KNOWLEDGE_ROUTES.brain}?answer=${gap.id}` },
                {
                    id: "dismiss",
                    label: t("gapDismiss"),
                    variant: "ghost",
                    onPress: () => command.send("gap.dismiss", { id: gap.id }, { done: t("gapDismissed") }),
                },
            ],
        }
    }
    return (
        <BrainGapsBase
            props={{
                list: {
                    section: {
                        id: "brain-gaps-title",
                        title: t("gapsTitle"),
                        description: t("gapsIntro"),
                        failTitle: t("loadFailed"),
                        error: note?.tone === "negative" ? t(note.text) : undefined,
                        notice: note?.tone === "affirmative" ? note.text : undefined,
                    },
                    label: t("gapsTitle"),
                    rows: props.gaps.map(rowOf),
                    isLoading: props.isLoading ?? false,
                    isPending: command.isPending,
                    emptyTitle: t("gapsEmpty"),
                },
            }}
        />
    )
}
