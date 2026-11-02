"use client"

import { useFormatter, useTranslations } from "next-intl"
import { failureKeyOf, publicBadgeOf, usePublicDocEditor } from "@/hooks/brain"
import type { PublicBadge, PublicDocument } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { toast } from "@/modules/toast"
import { PublicDocDraftBase } from "./component"

/** The tone of the badge of each state of a public document. */
const BADGE_TONE = {
    drafting: "neutral",
    failed: "danger",
    review: "danger",
    published: "success",
    pending: "warning",
} as const satisfies Record<PublicBadge, "neutral" | "warning" | "success" | "danger">

/** The route-selected draft; no drawer is drawn without a selection. */
interface PublicDocDraftProps {
    readonly docId: string | undefined
}

type Translate = ReturnType<typeof useTranslations<"publicBrain">>

/** Resolves the reason this document is waiting for the owner. */
const alertOf = (t: Translate, doc: PublicDocument, badge: PublicBadge) => {
    if (badge === "drafting") return { tone: "informative", title: t("alertDrafting") } as const
    if (badge === "failed") return { tone: "negative", title: t(failureKeyOf(doc.failureCode)) } as const
    return badge === "review" ? ({ tone: "cautionary", title: t("alertReview") } as const) : undefined
}

/** Resolves the saved snapshot's provenance independently of the text still being edited. */
const snapshotViewOf = (doc: PublicDocument, t: Translate, format: ReturnType<typeof useFormatter>) => {
    const badge = publicBadgeOf(doc)
    const left = doc.leftOut.map((item) => (item.reason === "" ? item.label : `${item.label} · ${item.reason}`))
    return {
        id: doc.id,
        badge: { label: t(`badge_${badge}`), tone: BADGE_TONE[badge] },
        alert: alertOf(t, doc, badge),
        canEdit: badge !== "drafting",
        sources: doc.sources.map((source) => ({
            id: source.sourceId,
            title: source.title,
            changedLabel: source.changed ? t("sourceChanged") : undefined,
        })),
        leftOut: left.length === 0 ? undefined : t("leftOutLine", { items: left.join(", ") }),
        approval:
            doc.approvedByName === null || doc.approvedAt === null
                ? undefined
                : t("approvedBy", {
                      name: doc.approvedByName,
                      when: format.dateTime(new Date(doc.approvedAt), { dateStyle: "medium" }),
                  }),
        publishedBody: doc.publishedBody,
        redraftLabel: doc.needsReview || badge === "failed" ? t("redraft") : undefined,
        approveLabel:
            badge === "drafting" || badge === "failed"
                ? undefined
                : t(doc.needsReview ? "approveAgain" : "approveAndPublish"),
    }
}

/** Opens the exact reviewed draft, retaining its own read failure, editable text and published snapshot. */
export const PublicDocDraft = (props: PublicDocDraftProps) => {
    const t = useTranslations("publicBrain")
    const feedback = useTranslations("toast")
    const format = useFormatter()
    const editor = usePublicDocEditor(props.docId)
    const slotLabels = useSlotLabels()
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
    if (props.docId === undefined || !editor.canWrite) return null
    return (
        <PublicDocDraftBase
            props={{
                title: editor.doc?.title ?? t("seeDraft"),
                closeLabel: t("cancel"),
                isPending: editor.isPending,
                pendingAction: editor.pendingAction,
                document: mapSlot(editor.slot, (documents) =>
                    documents.map((doc) => ({
                        ...snapshotViewOf(doc, t, format),
                        titleLabel: t("draftTitleLabel"),
                        bodyLabel: t("draftBodyLabel"),
                        sourcesLabel: t("draftSourcesLabel"),
                        publishedLabel: t("publishedSnapshot"),
                        docTitle: editor.title,
                        body: editor.body,
                        error: editor.error,
                        failTitle: t("loadFailed"),
                        saveLabel: t("save"),
                        laterLabel: t("later"),
                    })),
                ),
                slotLabels: slotLabels(t("draftMissing")),
            }}
            on={{
                close: editor.close,
                setTitle: editor.setTitle,
                setBody: editor.setBody,
                save: () => {
                    editor.save().catch(failed)
                },
                redraft: () => {
                    editor.redraft().catch(failed)
                },
                approve: () => {
                    editor.approve().catch(failed)
                },
                retry: editor.reload,
            }}
        />
    )
}
