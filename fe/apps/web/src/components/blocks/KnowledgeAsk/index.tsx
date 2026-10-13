"use client"

import { useTranslations } from "next-intl"
import { AGENT_MODULES, useAskKnowledge } from "@/hooks/knowledge"
import type { AgentModule, CommandActions } from "@/hooks/knowledge"
import { writeCommandWait } from "@/modules/db/knowledge/write-command-wait"
import { writeCommand } from "@/modules/db/knowledge/write-command"
import { KnowledgeAskBase } from "./component"

/** Props for the connected question panel. */
interface KnowledgeAskProps {
    readonly workspaceId: string
    /** The agent the panel starts on. */
    readonly module: AgentModule
    /** True while the page loads: the labels stay and the inputs are skeletons. */
    readonly isLoading?: boolean
}

const ACTIONS: CommandActions = { write: writeCommand, wait: writeCommandWait }

/** The connected question panel: asks the back end what an agent would retrieve and draws the passages. */
export const KnowledgeAsk = (props: KnowledgeAskProps) => {
    const t = useTranslations("knowledge")
    const ask = useAskKnowledge(props.workspaceId, props.module, ACTIONS)
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
                module: ask.module,
                audience: ask.audience,
                isPending: ask.isPending,
                isSkeleton: props.isLoading ?? false,
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
                error: ask.errorKey === null ? undefined : t(ask.errorKey),
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
