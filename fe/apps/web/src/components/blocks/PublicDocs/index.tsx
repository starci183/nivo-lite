"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    publicBadgeOf,
    listedPublicDocs,
    useFailureToast,
    usePublicDocCommands,
    usePublicDocuments,
} from "@/hooks/brain"
import type { PublicBadge, PublicDocument } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { KnowledgeRowView } from "@/modules/types"
import { brainTabHref } from "@/modules/routes"
import { PublicDocsBase } from "./component"

/** The tone of each badge a public document wears. */
const BADGE_TONE = {
    drafting: "neutral",
    failed: "danger",
    review: "danger",
    published: "success",
    pending: "warning",
} as const satisfies Record<PublicBadge, "neutral" | "warning" | "success" | "danger">

/** The words of the link that opens a document, by the badge it wears. */
const OPEN_KEY = {
    drafting: "seeDraft",
    failed: "seeDraft",
    review: "seeChanges",
    published: "edit",
    pending: "seeDraft",
} as const satisfies Record<PublicBadge, string>

/** Records the published authority using the catalog and locale formatter of the connected owner. */
const approvalOf = (
    doc: PublicDocument,
    t: ReturnType<typeof useTranslations<"publicBrain">>,
    format: ReturnType<typeof useFormatter>,
) =>
    doc.approvedByName === null || doc.approvedAt === null
        ? t("notApproved")
        : t("approvedBy", {
              name: doc.approvedByName,
              when: format.dateTime(new Date(doc.approvedAt), { dateStyle: "medium" }),
          })

/** The connected public documents: the card that starts one, and the list of what customers may read or will once approved. */
export const PublicDocs = () => {
    const t = useTranslations("publicBrain")
    const failed = useFailureToast()
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { slot, reload, canWrite, documents } = usePublicDocuments()
    const commands = usePublicDocCommands()
    const [archiving, setArchiving] = useState<string | undefined>()
    const rowOf = (doc: PublicDocument): KnowledgeRowView => {
        const badge = publicBadgeOf(doc)
        return {
            id: doc.id,
            title: doc.title,
            lines: [approvalOf(doc, t, format), t("fromSources", { n: doc.sources.length })],
            badges: [{ label: t(`badge_${badge}`), tone: BADGE_TONE[badge] }],
            actions: canWrite
                ? [
                      {
                          id: "open",
                          label: t(OPEN_KEY[badge]),
                          intent: "neutral",
                          href: brainTabHref("publicDocs", { doc: doc.id }),
                      },
                      {
                          id: "archive",
                          label: t("archive"),
                          intent: "destructive",
                          isPending: archiving === doc.id,
                          confirmation: {
                              title: t("archiveQuestion", { title: doc.title }),
                              description: t("archiveConsequence"),
                              confirmLabel: t("archive"),
                              cancelLabel: t("cancel"),
                          },
                      },
                  ]
                : [],
        }
    }
    const confirm = async (rowId: string, actionId: string) => {
        if (!canWrite || actionId !== "archive" || !listedPublicDocs(documents).some((doc) => doc.id === rowId)) {
            failed()
            throw new Error("public document archive is unavailable")
        }
        setArchiving(rowId)
        try {
            const archived = await commands.archive(rowId, t("archived"))
            if (archived !== true) throw new Error("public document archive did not succeed")
        } finally {
            setArchiving(undefined)
        }
    }
    return (
        <PublicDocsBase
            props={{
                compose: canWrite
                    ? {
                          title: t("composeTitle"),
                          note: t("composeNote"),
                          draftLabel: t("composeDraft"),
                          draftHref: brainTabHref("publicDocs", { compose: "pick" }),
                          writeLabel: t("composeWrite"),
                          writeHref: brainTabHref("publicDocs", { compose: "write" }),
                      }
                    : null,
                list: {
                    section: { id: "public-docs-title", title: t("listTitle"), failTitle: t("loadFailed") },
                    label: t("listTitle"),
                    footer: t("listFooter"),
                    isPending: commands.isPending,
                    slot: mapSlot(slot, (all) => listedPublicDocs(all).map(rowOf)),
                    slotLabels: slotLabels(t("listEmpty")),
                },
            }}
            on={{ retry: reload, confirm }}
        />
    )
}
