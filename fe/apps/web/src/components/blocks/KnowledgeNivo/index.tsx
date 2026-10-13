"use client"

import { useTranslations } from "next-intl"
import { isAgentModule } from "@/hooks/knowledge"
import type { NivoEntry } from "@/modules/types"
import { KnowledgeNivoBase } from "./component"

/** Props for the connected base knowledge. */
interface KnowledgeNivoProps {
    readonly items: ReadonlyArray<NivoEntry>
    /** True while the page loads: the list is skeleton rows. */
    readonly isLoading?: boolean
}

/** The connected base knowledge of NIVO: words each item for the language of the person. */
export const KnowledgeNivo = (props: KnowledgeNivoProps) => {
    const t = useTranslations("knowledge")
    return (
        <KnowledgeNivoBase
            props={{
                list: {
                    label: t("nivoTitle"),
                    isLoading: props.isLoading ?? false,
                    isPending: false,
                    emptyTitle: t("nivoEmpty"),
                    rows: props.items.map((item) => ({
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
