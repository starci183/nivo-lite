"use client"

import { useFormatter, useTranslations } from "next-intl"
import { SEVERITY_TONE, findingActionsOf } from "@/modules/brain"
import type { FindingActionView, FindingRowView, FindingView, MemberOption } from "@/modules/brain"
import { brainDossierHref, brainUploadHref, knowledgeSourceHref } from "@/modules/routes"
import { ownerPartOf, placeWordsOf, statusPartOf } from "./brain.shared"

/** The dossier a pane's findings are filed under: what the upload action needs to file a document under it. */
export interface UploadTarget {
    readonly category: string
    readonly tag: string
}

/** What a row needs to know besides its finding. */
export interface FindingRowContext {
    readonly members: ReadonlyArray<MemberOption>
    readonly canWrite: boolean
    /** The finding the address points at. */
    readonly focusedId: string | undefined
    /** Rows of a list across dossiers lead to their dossier and name it; rows of one dossier's pane do neither. */
    readonly showDossier: boolean
    /** Where the upload action files a document; without it the row offers no upload. */
    readonly upload: UploadTarget | null
}

/** Puts a finding into the words of a row: its badges, the one muted line, its evidence and its actions. */
export const useFindingRows = () => {
    const t = useTranslations("dossierReview")
    const format = useFormatter()
    const rowOf = (finding: FindingView, context: FindingRowContext): FindingRowView => {
        const meta = [
            context.showDossier ? finding.dossierName : null,
            statusPartOf(t, finding),
            ownerPartOf(t, finding, context.members),
            finding.dueAt === null
                ? null
                : [t("dueDate"), format.dateTime(new Date(finding.dueAt), { dateStyle: "medium" })].join(": "),
            finding.note,
        ].filter((part) => part !== null && part !== "")
        const sources = new Map<string, string>()
        for (const one of finding.evidence) {
            if (one.sourceId !== null && one.sourceTitle !== null) sources.set(one.sourceId, one.sourceTitle)
        }
        return {
            id: finding.id,
            title: finding.title,
            titleHref:
                context.showDossier && finding.dossierId !== null
                    ? brainDossierHref(finding.dossierId, { finding: finding.id })
                    : null,
            detail: finding.detail,
            badges: [
                { id: "severity", label: t(`severity_${finding.severity}`), tone: SEVERITY_TONE[finding.severity] },
                { id: "kind", label: t(`kind_${finding.kind}`), tone: "neutral" },
                ...(finding.isAi ? [{ id: "ai", label: t("aiBadge"), tone: "muted" } as const] : []),
            ],
            meta: meta.length === 0 ? null : meta.join(" · "),
            isFocused: finding.id === context.focusedId,
            evidenceTitle: t("evidenceTitle", { count: finding.evidence.length }),
            evidence: finding.evidence.map((one, index) => ({
                id: `${finding.id}-${index}`,
                label: one.quote ?? one.factLine ?? one.label,
                ...(one.quote === null
                    ? {}
                    : {
                          description: [one.label, one.place === null ? null : placeWordsOf(t)(one.place)]
                              .filter((part) => part !== null)
                              .join(" · "),
                      }),
            })),
            sources: [...sources].map(([id, title]) => ({
                id,
                label: t("evidenceFrom", { title }),
                href: knowledgeSourceHref(id),
            })),
            actions: findingActionsOf(finding, context.canWrite).flatMap((action): ReadonlyArray<FindingActionView> => {
                if (action !== "upload") return [{ id: action, label: t(action), href: null }]
                if (context.upload === null) return []
                return [
                    {
                        id: action,
                        label: t(action),
                        href: brainUploadHref(context.upload.category, context.upload.tag),
                    },
                ]
            }),
        }
    }
    return { rowOf }
}
