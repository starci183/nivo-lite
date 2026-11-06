"use client"

import { useFormatter, useTranslations } from "next-intl"
import { SEVERITY_TONE, needsDocumentOf, quotesOf } from "@/modules/brain"
import type { FindingCardView, FindingView } from "@/modules/brain"
import { brainDossierHref, workspaceHref } from "@/modules/routes"
import { cardActionsOf, ownerPartOf, placeWordsOf, statusPartOf } from "./brain.shared"
import type { FindingCardContext } from "./brain.shared"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The view `useFindingCards` returns. */
export interface FindingCardsView {
    cardOf: (finding: FindingView, context: FindingCardContext) => FindingCardView
}

/** Puts a finding into the words of a card of the queue: its quotes side by side and the actions that answer it. */
export const useFindingCards = (): FindingCardsView => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("dossierReview")
    const format = useFormatter()
    const cardOf = (finding: FindingView, context: FindingCardContext): FindingCardView => {
        const meta = [
            statusPartOf(t, finding),
            ownerPartOf(t, finding, context.members),
            finding.dueAt === null
                ? null
                : [t("dueDate"), format.dateTime(new Date(finding.dueAt), { dateStyle: "medium" })].join(": "),
            finding.note,
        ].filter((part) => part !== null && part !== "")
        const needsDocument: ReadonlyArray<FindingCardView["badges"][number]> = needsDocumentOf(finding)
            ? [{ id: "document", label: t("cardNeedsDocument"), tone: "warning" }]
            : []
        const aiBadge: ReadonlyArray<FindingCardView["badges"][number]> = finding.isAi
            ? [{ id: "ai", label: t("aiBadge"), tone: "muted" }]
            : []
        const extraBadges = [...needsDocument, ...aiBadge]
        const dossierName = [finding.dossierRef, finding.dossierName].filter((part) => part !== null && part !== "")
        return {
            id: finding.id,
            kind: { label: t(`kind_${finding.kind}`), tone: "neutral" },
            dossier:
                finding.dossierId === null || dossierName.length === 0
                    ? null
                    : {
                          label: t("cardDossier", { name: dossierName.join(" · ") }),
                          href: workspaceHref(
                              workspaceId,
                              brainDossierHref(finding.dossierId, { finding: finding.id }),
                          ),
                      },
            title: finding.title,
            detail: finding.detail,
            badges: [
                { id: "severity", label: t(`severity_${finding.severity}`), tone: SEVERITY_TONE[finding.severity] },
                ...extraBadges,
            ],
            meta: meta.length === 0 ? null : meta.join(" · "),
            quotes: quotesOf(finding, placeWordsOf(t)),
            inUse: finding.inUse,
            actions: cardActionsOf(t, finding, context, workspaceId),
        }
    }
    return { cardOf }
}
