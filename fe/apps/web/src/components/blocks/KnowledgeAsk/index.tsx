"use client"

import { useTranslations } from "next-intl"
import { AGENT_MODULES, useAskKnowledge, useAskModule, type ModuleKey } from "@/hooks/knowledge"

import { KnowledgeAskBase } from "./component"

/** Props for the connected question panel. */
interface KnowledgeAskProps {
    /** The agent of the address; "all" starts the panel on the first installed agent. */
    readonly module: ModuleKey | "all"
}

/** The connected question panel: asks the back end what an agent would retrieve and draws the passages. */
export const KnowledgeAsk = (props: KnowledgeAskProps) => {
    const t = useTranslations("knowledge")
    const start = useAskModule(props.module)
    const ask = useAskKnowledge(start.module)
    return (
        <KnowledgeAskBase
            props={{
                title: t("askTitle"),
                hint: t("askHint"),
                placeholder: t("askPlaceholder"),
                questionLabel: t("askTitle"),
                moduleLabel: t("askModule"),
                moduleOptions: AGENT_MODULES.map((key) => ({ id: key, label: t(`module_${key}`) })),
                audienceLabel: t("fieldVisibility"),
                audienceOptions: [
                    { id: "customer", label: t("askAudiencePublic") },
                    { id: "internal", label: t("askAudienceInternal") },
                ],
                submitLabel: ask.isPending ? t("asking") : t("askButton"),
                failTitle: t("askFailed"),
                question: ask.question,
                module: ask.module ?? start.module,
                audience: ask.audience,
                isPending: ask.isPending,
                isSkeleton: start.isLoading,
                results:
                    ask.results === null
                        ? undefined
                        : {
                              label: t("askTitle"),
                              isLoading: false,
                              isPending: false,
                              emptyTitle: t("askEmpty"),
                              rows: ask.results.map((passage) => ({
                                  id: passage.key,
                                  title: passage.title,
                                  lines: [passage.content],
                                  badges: [
                                      {
                                          label: t(passage.layer === "nivo" ? "layerNivo" : "layerBusiness"),
                                          tone: "accent",
                                      },
                                      {
                                          label: t(passage.visibility === "public" ? "vis_public" : "vis_internal"),
                                          tone: "neutral",
                                      },
                                      {
                                          label: t("score", { score: Math.round(passage.score * 100) }),
                                          tone: "neutral",
                                      },
                                  ],
                              })),
                          },
                error: ask.error ?? undefined,
            }}
            on={{
                setQuestion: ask.setQuestion,
                setModule: ask.setModule,
                setAudience: ask.setAudience,
                ask: ask.ask,
            }}
        />
    )
}
