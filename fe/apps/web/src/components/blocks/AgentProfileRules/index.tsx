"use client"

import { useTranslations } from "next-intl"
import { useProfileRegion, type AuthorityMode } from "@/hooks/agentProfile"
import { mapSlot } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentProfileRulesBase } from "./component"
import { actionWordOf } from "@/hooks/actionWord"

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
    const workspaceId = useWorkspaceId()
    /** The rule's name as a noun ("Hoa don xuat"), else the action's shared words. */
    const ruleNameOf = (action: string): string => {
        const name = action.slice(action.lastIndexOf(".") + 1)
        return t.has(`ruleName_${name}`) ? t(`ruleName_${name}`) : actionWordOf(g, action)
    }
    return (
        <AgentProfileRulesBase
            props={{
                label: t("rulesTitle"),
                read: {
                    slot: mapSlot(region.slot, (items) =>
                        items.map((rule) => ({
                            id: rule.action,
                            title: ruleNameOf(rule.action),
                            description: rule.note === "" ? t(`ruleHint_${rule.mode}`) : rule.note,
                            mark: null,
                            badges: [{ label: t(`mode_${rule.mode}`), tone: TONE[rule.mode] }],
                            meta: null,
                            open: null,
                        })),
                    ),
                    placeholder: [],
                    labels: region.labels(t("rulesEmpty")),
                },
                count: "items" in region.slot ? region.slot.items.length : null,
                isAttention: false,
                action: { label: t("rulesEdit"), href: workspaceHref(workspaceId, CONSOLE_ROUTES.authority) },
            }}
            on={{ retry: region.reload }}
        />
    )
}
