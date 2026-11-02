"use client"

import { useTranslations } from "next-intl"
import { useAgentLenses } from "@/hooks/brain"
import type { AgentLens } from "@/hooks/brain"
import { isAgentModule, useAskKnowledge } from "@/hooks/knowledge"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
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

/** Props for the connected panel. */
interface KnowledgeAskProps {
    /** Every question is asked for this audience, with no choice offered; the public part asks as a customer. */
    readonly fixedAudience?: "customer"
}

/** The connected "ask as an agent" panel: asks the back end what an agent would retrieve through its own view, and cites where it read it. */
export const KnowledgeAsk = (props: KnowledgeAskProps) => {
    const t = useTranslations("knowledge")
    const pub = useTranslations("publicBrain")
    const slotLabels = useSlotLabels()
    const { lenses, slot, reload } = useAgentLenses()
    const all = (lenses ?? []).filter((lens) => lens.kind === "agent")
    const facing = all.filter((lens) => lens.audience === props.fixedAudience)
    const agents = props.fixedAudience === undefined || facing.length === 0 ? all : facing
    const ask = useAskKnowledge(agents, props.fixedAudience)
    return (
        <KnowledgeAskBase
            props={{
                title: props.fixedAudience === undefined ? t("askTitle") : pub("tryTitle"),
                hint: props.fixedAudience === undefined ? t("askHint") : pub("tryHint"),
                placeholder: t("askPlaceholder"),
                questionLabel: t("askQuestion"),
                agentLabel: t("askModule"),
                selectPlaceholder: t("selectPlaceholder"),
                agents: mapSlot(slot, () => agents.map((lens) => ({ id: lens.id, label: lens.name ?? "" }))),
                agentsLabels: slotLabels(t("askNoAgents")),
                audienceLabel: t("askAudience"),
                audienceOptions: audienceOptionsOf(t),
                submitLabel: ask.isPending ? t("asking") : t("askButton"),
                failTitle: t("askFailed"),
                question: ask.question,
                agent: identityOf(t, ask.agent, ask.audience),
                audience: ask.audience,
                canPickAudience: ask.canPickAudience,
                isPending: ask.isPending,
                results:
                    ask.results === null
                        ? undefined
                        : {
                              label: t("askTitle"),
                              slot: { items: ask.results.map((passage) => passageRowOf(t, passage)) },
                              slotLabels: slotLabels(t("askEmpty")),
                          },
                error: ask.error ?? undefined,
            }}
            on={{
                setQuestion: ask.setQuestion,
                setAgent: ask.setAgent,
                setAudience: ask.setAudience,
                ask: ask.ask,
                retry: reload,
            }}
        />
    )
}
