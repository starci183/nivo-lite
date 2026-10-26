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
const captionOf = (t: Translate, lens: AgentLens, audience: string): string => {
    const moduleLabel = lens.module !== null && isAgentModule(lens.module) ? t(`module_${lens.module}`) : ""
    return [moduleLabel, t(audience === "customer" ? "askAudiencePublic" : "askAudienceInternal")]
        .filter(Boolean)
        .join(" · ")
}

/** Where a passage was read from: the document and the place in it, or the base knowledge of NIVO. */
const citationOf = (t: Translate, passage: RetrievedPassage): string => {
    if (passage.layer === "fact") return t("citeFact")
    return passage.position === null
        ? t("citeBase")
        : t("citeDocument", { title: passage.title, position: passage.position })
}

const LAYER_KEY = { nivo: "layerNivo", business: "layerBusiness", fact: "layerFact" } as const
const VISIBILITY_KEY = { public: "vis_public", internal: "vis_internal", restricted: "vis_restricted" } as const

/** One row of the answer: the passage with the document it cites, its layer, who may read it and how well it matches. */
const passageRowOf = (t: Translate, passage: RetrievedPassage) => ({
    id: passage.key,
    title: passage.title,
    ...(passage.sourceId === null ? {} : { href: knowledgeSourceHref(passage.sourceId) }),
    lines: [citationOf(t, passage), passage.content],
    badges: [
        { label: t(LAYER_KEY[passage.layer]), tone: "accent" as const },
        { label: t(VISIBILITY_KEY[passage.visibility]), tone: "neutral" as const },
        ...(passage.layer === "fact"
            ? []
            : [{ label: t("score", { score: Math.round(passage.score * 100) }), tone: "neutral" as const }]),
    ],
})

/** The two audiences a question may be asked for. */
const audienceOptionsOf = (t: Translate) => [
    { id: "customer", label: t("askAudiencePublic") },
    { id: "internal", label: t("askAudienceInternal") },
]

/** The agent the question is asked as, with what it reads and for whom. */
const identityOf = (t: Translate, agent: AgentLens | undefined, audience: string) =>
    agent === undefined
        ? undefined
        : {
              id: agent.id,
              name: agent.name ?? "",
              avatarUrl: agent.avatarUrl ?? undefined,
              caption: captionOf(t, agent, audience),
          }

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
                selectPlaceholder: t("selectPlaceholder"),
                agentOptions: agents.map((lens) => ({ id: lens.id, label: lens.name ?? "" })),
                audienceLabel: t("askAudience"),
                audienceOptions: audienceOptionsOf(t),
                submitLabel: ask.isPending ? t("asking") : t("askButton"),
                failTitle: t("askFailed"),
                noAgents: t("askNoAgents"),
                question: ask.question,
                agent: identityOf(t, ask.agent, ask.audience),
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
