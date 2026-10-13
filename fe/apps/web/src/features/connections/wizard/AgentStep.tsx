"use client"

import { CheckboxGroup, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { purposeFor } from "@/lib/connection-access"

/** An agent the connection can be attached to. */
export type AgentOption = { readonly id: string; readonly name: string; readonly module: string }

/** Props for {@link AgentStep}. */
export type AgentStepProps = {
    readonly agents: ReadonlyArray<AgentOption>
    readonly value: ReadonlyArray<string>
    readonly onValue: (ids: ReadonlyArray<string>) => void
    readonly isDisabled?: boolean
    /** The connection's provider: each agent then says what it does through it (listens / sends / reads transactions). */
    readonly provider?: string
}

/** Last step: tick the workspace agent(s) that work through this connection (accounting for bank feeds; chatbot, booking and loyalty listen on Telegram/Zalo/Facebook/Instagram, sales and shifts send through them). */
export const AgentStep = ({ agents, value, onValue, isDisabled, provider }: AgentStepProps) => {
    const t = useT(connectionWizard)
    if (agents.length === 0) return <Text size="sm">{t("agentNone")}</Text>
    return (
        <>
            <Text size="sm" tone="muted">
                {t("agentHint")}
            </Text>
            <CheckboxGroup
                variant="secondary"
                label={t("agentHint")}
                isLabelHidden
                isDisabled={isDisabled}
                options={agents.map((a) => {
                    const purpose = provider ? purposeFor(a.module, provider) : null
                    return {
                        value: a.id,
                        label: a.name,
                        ...(purpose === "inbound_chat" ||
                        purpose === "outbound_chat" ||
                        purpose === "bank_feed" ||
                        purpose === "lead_source"
                            ? { description: t(`purpose_${purpose}`) }
                            : {}),
                    }
                })}
                value={[...value]}
                onValueChange={(v) => onValue(v)}
            />
        </>
    )
}
