"use client"

import { useTranslations } from "next-intl"
import { useBrainDocuments, useBrainKnowledgeHeader } from "@/hooks/brain"
import { useSlotLabels } from "@/hooks/slot"
import type { BrainPageHeading } from "@/modules/types"
import { BrainDocumentsBase } from "./component"

/** What the page hands the documents chip: the header without its tabs. */
interface BrainDocumentsProps {
    readonly header: BrainPageHeading
}

/**
 * The connected documents tab of the Second Brain: every document of the workspace with the facts it gave, and the drawer that
 * approves a document's safe facts together. Owners and managers approve; everyone reads.
 */
export const BrainDocuments = (props: BrainDocumentsProps) => {
    const header = useBrainKnowledgeHeader("sources", props.header)
    const t = useTranslations("brainDocuments")
    const slotLabels = useSlotLabels()
    const docs = useBrainDocuments()
    return (
        <BrainDocumentsBase
            props={{
                ...docs.props,
                labels: slotLabels(t("emptyTitle")),
                header: header.props,
                copy: {
                    tableLabel: t("tableLabel"),
                    columns: {
                        name: t("colName"),
                        facts: t("colFacts"),
                        status: t("colStatus"),
                        updated: t("colUpdated"),
                    },
                    noFacts: t("factsNone"),
                    emptyBody: t("emptyBody"),
                    emptyAction: t("emptyAction"),
                    errorBody: t("errorBody"),
                    stepsLabel: t("stepsLabel"),
                    factsEmpty: t("factsEmpty"),
                    close: t("close"),
                },
            }}
            on={{ ...docs.on, reviewAll: header.on.reviewAll, selectTab: header.on.selectTab }}
        />
    )
}
