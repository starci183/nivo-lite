"use client"

import { useTranslations } from "next-intl"
import { useProfileRegion } from "@/hooks/agentProfile"
import { mapSlot } from "@/hooks/slot"
import type { AuthorityMode } from "@/hooks/agentProfile"
import { AgentProfileRulesBase } from "./component"

/** The agent whose rules the card lists. */
type AgentProfileRulesProps = {
    readonly agentId: string
}

const TONE = { auto: "neutral", ask: "warning", never: "danger" } as const satisfies Record<AuthorityMode, string>

/** The connected "Rule ap dung" card: the rules of the owner that apply to the agent, read-only. */
export const AgentProfileRules = (props: AgentProfileRulesProps) => {
    const t = useTranslations("agentProfile")
    const g = useTranslations("governance")
    const region = useProfileRegion(props.agentId, (agent) => agent.rules)
    return (
        <AgentProfileRulesBase
            props={{
                label: t("rulesTitle"),
                read: {
                    slot: mapSlot(region.slot, (items) =>
                        items.map((rule) => ({
                            id: rule.action,
                            title: g.has(`action_${rule.action}`) ? g(`action_${rule.action}`) : rule.action,
                            description: rule.note === "" ? t(`ruleHint_${rule.mode}`) : rule.note,
                            mark: null,
                            badges: [{ label: t(`mode_${rule.mode}`), tone: TONE[rule.mode] }],
                        })),
                    ),
                    placeholder: [],
                    labels: region.labels(t("rulesEmpty")),
                },
                footer: t("rulesReadOnly"),
            }}
            on={{ retry: region.reload }}
        />
    )
}
