"use client"

import { useTranslations } from "next-intl"
import { useAgentLenses } from "@/hooks/brain"
import type { AgentLens } from "@/hooks/brain"
import { isAgentModule, useAskKnowledge } from "@/hooks/knowledge"
import type { RetrievedPassage } from "@/hooks/knowledge"
import { knowledgeSourceHref } from "@/modules/routes"

import { KnowledgeAskBase } from "./component"

type Translate = ReturnType<typeof useTranslations<"knowledge">>

/** What the agent reads and for whom, in one line under its name. */
const captionOf = (t: Translate, lens: AgentLens): string => {
    const moduleLabel = lens.module !== null && isAgentModule(lens.module) ? t(`module_${lens.module}`) : ""
    return [moduleLabel, t(lens.audience === "customer" ? "askAudiencePublic" : "askAudienceInternal")]
        .filter(Boolean)
        .join(" · ")
}

/** Where a passage was read from: the document and the place in it, or the base knowledge of NIVO. */
const citationOf = (t: Translate, passage: RetrievedPassage): string =>
    passage.position === null ? t("citeBase") : t("citeDocument", { title: passage.title, position: passage.position })

/** One row of the answer: the passage with the document it cites, its layer, who may read it and how well it matches. */
const passageRowOf = (t: Translate, passage: RetrievedPassage) => ({
    id: passage.key,
    title: passage.title,
    ...(passage.sourceId === null ? {} : { href: knowledgeSourceHref(passage.sourceId) }),
    lines: [citationOf(t, passage), passage.content],
    badges: [
        { label: t(passage.layer === "nivo" ? "layerNivo" : "layerBusiness"), tone: "accent" as const },
        { label: t(passage.visibility === "public" ? "vis_public" : "vis_internal"), tone: "neutral" as const },
        { label: t("score", { score: Math.round(passage.score * 100) }), tone: "neutral" as const },
    ],
})

/** The connected "ask as an agent" panel: asks the back end what an agent would retrieve through its own view, and cites where it read it. */
export const KnowledgeAsk = () => {
    const t = useTranslations("knowledge")
    const { lenses, isLoading } = useAgentLenses()
    const agents = (lenses ?? []).filter((lens) => lens.kind === "agent")
    const ask = useAskKnowledge(agents)
    return (
        <KnowledgeAskBase
            props={{
                title: t("askTitle"),
                hint: t("askHint"),
                placeholder: t("askPlaceholder"),
                questionLabel: t("askQuestion"),
                agentLabel: t("askModule"),
                agentOptions: agents.map((lens) => ({ id: lens.id, label: lens.name ?? "" })),
                audienceLabel: t("askAudience"),
                audienceOptions: [
                    { id: "customer", label: t("askAudiencePublic") },
                    { id: "internal", label: t("askAudienceInternal") },
                ],
                submitLabel: ask.isPending ? t("asking") : t("askButton"),
                failTitle: t("askFailed"),
                noAgents: t("askNoAgents"),
                question: ask.question,
                agent:
                    ask.agent === undefined
                        ? undefined
                        : {
                              id: ask.agent.id,
                              name: ask.agent.name ?? "",
                              avatarUrl: ask.agent.avatarUrl ?? undefined,
                              caption: captionOf(t, ask.agent),
                          },
                audience: ask.audience,
                canPickAudience: ask.canPickAudience,
                isPending: ask.isPending,
                isSkeleton: isLoading || lenses === undefined,
                results:
                    ask.results === null
                        ? undefined
                        : {
                              label: t("askTitle"),
                              isLoading: false,
                              isPending: false,
                              emptyTitle: t("askEmpty"),
                              rows: ask.results.map((passage) => passageRowOf(t, passage)),
                          },
                error: ask.error ?? undefined,
            }}
            on={{
                setQuestion: ask.setQuestion,
                setAgent: ask.setAgent,
                setAudience: ask.setAudience,
                ask: ask.ask,
            }}
        />
    )
}
