"use client"

import { useTranslations } from "next-intl"
import { useDossierReviewCommands, useDossierReviewSummary } from "@/hooks/brain"
import { useWorkspaceMember } from "@/hooks/knowledge"
import { brainTabHref } from "@/modules/routes"
import type { BrainTab } from "@/modules/routes"
import { BrainPageActionsBase } from "./component"

/** Props for the connected commands of the header: the tab they sit on. */
interface BrainPageActionsProps {
    readonly tab: BrainTab
}

/** The connected commands of the Second Brain header; owners and managers see them, everyone else reads. */
export const BrainPageActions = (props: BrainPageActionsProps) => {
    const t = useTranslations("secondBrain")
    const review = useTranslations("dossierReview")
    const member = useWorkspaceMember()
    const summary = useDossierReviewSummary()
    const commands = useDossierReviewCommands()
    return (
        <BrainPageActionsBase
            props={{
                review:
                    member.canWrite && props.tab === "dossiers"
                        ? {
                              label: review("reviewAll"),
                              isRunning: summary.isRunning,
                              runningLabel: review("reviewRunning"),
                          }
                        : null,
                add:
                    member.canWrite && props.tab !== "sources"
                        ? { label: t("addDocuments"), href: brainTabHref("sources") }
                        : null,
            }}
            on={{ review: () => void commands.requestReview(null) }}
        />
    )
}
