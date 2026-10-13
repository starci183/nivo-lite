"use client"

import { useTranslations } from "next-intl"
import { isAgentModule, useNivoKnowledge } from "@/hooks/knowledge"
import { KnowledgeNivoBase } from "./component"

/** The connected base knowledge of NIVO: words each item for the language of the person. */
export const KnowledgeNivo = () => {
    const t = useTranslations("knowledge")
    const { items, isLoading } = useNivoKnowledge()
    return (
        <KnowledgeNivoBase
            props={{
                list: {
                    label: t("nivoTitle"),
                    isLoading: isLoading || items === undefined,
                    isPending: false,
                    emptyTitle: t("nivoEmpty"),
                    rows: (items ?? []).map((item) => ({
                        id: item.id,
                        title: item.title,
                        lines: [t("nivoVersion", { version: item.version }), item.body],
                        badges: [
                            { label: t(`nivoKind_${item.kind}`), tone: "accent" },
                            {
                                label: isAgentModule(item.module) ? t(`module_${item.module}`) : t("moduleCore"),
                                tone: "neutral",
                            },
                        ],
                    })),
                },
            }}
        />
    )
}
