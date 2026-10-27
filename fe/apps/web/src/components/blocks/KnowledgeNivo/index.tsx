"use client"

import { useTranslations } from "next-intl"
import { isAgentModule, useNivoKnowledge } from "@/hooks/knowledge"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { KnowledgeNivoBase } from "./component"

/** The connected base knowledge of NIVO: words each item for the language of the person. */
export const KnowledgeNivo = () => {
    const t = useTranslations("knowledge")
    const slotLabels = useSlotLabels()
    const { slot, reload } = useNivoKnowledge()
    return (
        <KnowledgeNivoBase
            props={{
                label: t("nivoTitle"),
                slotLabels: slotLabels(t("nivoEmpty")),
                slot: mapSlot(slot, (items) =>
                    items.map((item) => ({
                        id: item.id,
                        title: item.title,
                        lines: [t("nivoVersion", { version: item.version }), item.body],
                        badges: [
                            { label: t(`nivoKind_${item.kind}`), tone: "accent" as const },
                            {
                                label: isAgentModule(item.module) ? t(`module_${item.module}`) : t("moduleCore"),
                                tone: "neutral" as const,
                            },
                        ],
                    })),
                ),
            }}
            on={{ retry: reload }}
        />
    )
}
