"use client"

import { useTranslations } from "next-intl"
import { AGENT_MODULES, moduleFilterOf, useKnowledgeSources } from "@/hooks/knowledge"
import type { AgentModule } from "@/hooks/knowledge"
import { useKnowledgeRowOf } from "@/hooks/brain"
import { loadingSlot, mapSlot, useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { brainTabHref, knowledgeSourceHref } from "@/modules/routes"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import { KnowledgeLibraryBase } from "./component"

/** Props for the connected documents list. */
interface KnowledgeLibraryProps {
    /** The agent the list is filtered to, from the address. */
    readonly module: AgentModule | "all"
}

/** The connected documents list: filters by agent through the address, retries a failed document. */
export const KnowledgeLibrary = (props: KnowledgeLibraryProps) => {
    const t = useTranslations("knowledge")
    const router = navigation.useRouter()
    const { sources, live, slot, reload } = useKnowledgeSources()
    const { rowOf, commands, member, board } = useKnowledgeRowOf(live)
    const slotLabels = useSlotLabels()
    const shown = (sources ?? []).filter((source) => props.module === "all" || source.module === props.module)
    const filterTo = (value: string | null) => {
        const next = moduleFilterOf(value)
        router.replace(brainTabHref("sources", { module: next === "all" ? undefined : next }))
    }
    return (
        <KnowledgeLibraryBase
            props={{
                list: {
                    section: {
                        id: "knowledge-library-title",
                        title: t("listTitle"),
                        failTitle: t("detailFailed"),
                    },
                    label: t("listTitle"),
                    footer: t("listCount", { count: shown.length }),
                    isPending: commands.retrying.size > 0,
                    slot:
                        member.isLoading || board.slot.isLoading
                            ? loadingSlot<ReadonlyArray<KnowledgeRowView>>()
                            : mapSlot(slot, () =>
                                  shown.map((source) => ({ ...rowOf(source), href: knowledgeSourceHref(source.id) })),
                              ),
                    slotLabels: slotLabels(t("emptyTitle")),
                },
                filterLabel: t("filterModule"),
                selectPlaceholder: t("selectPlaceholder"),
                filterOptions: [
                    { id: "all", label: t("filterAll") },
                    ...AGENT_MODULES.map((key) => ({ id: key, label: t(`module_${key}`) })),
                ],
                filter: props.module,
            }}
            on={{ setFilter: filterTo, retry: reload }}
        />
    )
}
