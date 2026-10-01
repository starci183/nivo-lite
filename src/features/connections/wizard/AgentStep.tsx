"use client"

import { CheckboxGroup, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"

/** An agent the connection can be attached to. */
export type AgentOption = { readonly id: string; readonly name: string; readonly module: string }

/** Props for {@link AgentStep}. */
export type AgentStepProps = {
  readonly agents: ReadonlyArray<AgentOption>
  readonly value: ReadonlyArray<string>
  readonly onValue: (ids: ReadonlyArray<string>) => void
  readonly isDisabled?: boolean
}

/** Last step: tick the workspace agent(s) that work through this connection (accounting for bank feeds, chatbot for Telegram). */
export const AgentStep = ({ agents, value, onValue, isDisabled }: AgentStepProps) => {
  const t = useT(connectionWizard)
  if (agents.length === 0) return <Text size="sm">{t("agentNone")}</Text>
  return (
    <>
      <Text size="sm" tone="muted">{t("agentHint")}</Text>
      <CheckboxGroup
        label={t("agentHint")}
        isLabelHidden
        isDisabled={isDisabled}
        options={agents.map((a) => ({ value: a.id, label: a.name }))}
        value={[...value]}
        onValueChange={(v) => onValue(v)}
      />
    </>
  )
}
