"use client"

import { useState } from "react"
import { Alert, Button, Heading, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import { runAutomationNow } from "@/lib/automation-actions"
import type { AutomationCardView, AutomationRunView, ConfigValue, ShopContext } from "@/lib/automation-shared"
import { ACTIONS_CLASS, CARD_FOOT_CLASS, DETAIL_CLASS, FACTS_CLASS } from "./classNames"
import { GatePanel } from "./GatePanel"
import { loc } from "./helpers"
import { MessageSection } from "./MessageSection"
import { RunsList } from "./RunsList"
import { SettingsForm } from "./SettingsForm"

/** Props for {@link AutomationDetail}. */
export type AutomationDetailProps = {
  readonly card: AutomationCardView
  readonly runs: ReadonlyArray<AutomationRunView>
  readonly shop: ShopContext
  readonly busy: boolean
  readonly error: string | null
  /** The owner pressed the switch while no message was approved yet. */
  readonly awaitingMessage: boolean
  readonly onClose: () => void
  readonly onSaveValues: (values: Record<string, ConfigValue>) => Promise<boolean>
  readonly onSaveBody: (body: string) => Promise<boolean>
  readonly onSaveAndEnable: (body: string) => Promise<boolean>
  readonly onAnswerTrust: (accept: boolean) => void
  readonly onDismiss: () => void
  readonly onError: (message: string) => void
}

/** Everything about one automation: settings, the approved message and its preview, authority, guardrails and recent runs. */
export const AutomationDetail = ({ card, runs, shop, busy, error, awaitingMessage, onClose, onSaveValues, onSaveBody, onSaveAndEnable, onAnswerTrust, onDismiss, onError }: AutomationDetailProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const [starting, setStarting] = useState(false)
  const [started, setStarted] = useState<string | null>(null)
  return (
    <aside className={DETAIL_CLASS} aria-label={loc(card.def.name, locale)} id="automation-detail">
      <div className={CARD_FOOT_CLASS}>
        <div className={FACTS_CLASS}>
          <Heading level={2}>{loc(card.def.name, locale)}</Heading>
          <Text size="sm" tone="muted">{loc(card.def.description, locale)}</Text>
        </div>
        <Button variant="ghost" size="sm" onPress={onClose}>{t("detailClose")}</Button>
      </div>
      {awaitingMessage ? <Alert title={t("needsMessage")} tone="informative" /> : null}
      {error ? <Alert title={error} tone="negative" /> : null}
      <SettingsForm key={`${card.key}-s`} card={card} busy={busy} onSave={onSaveValues} />
      <MessageSection key={`${card.key}-m`} card={card} shop={shop} busy={busy} onSaveBody={onSaveBody} onSaveAndEnable={onSaveAndEnable} onError={onError} />
      <GatePanel card={card} onAnswerTrust={onAnswerTrust} />
      {card.def.executor === "n8n" && card.def.trigger.kind === "schedule" && card.enabled ? (
        <div className={ACTIONS_CLASS}>
          <Button variant="secondary" isPending={starting} onPress={() => { setStarting(true); setStarted(null); void runAutomationNow(card.key).then((r) => { setStarting(false); r.ok ? setStarted(t("runNowStarted")) : onError(r.error) }) }}>{t("runNow")}</Button>
          {started ? <span role="status" className="text-sm text-success">{started}</span> : null}
        </div>
      ) : null}
      <RunsList runs={runs} />
      <div className={ACTIONS_CLASS}>
        <Button variant="ghost" size="sm" isDisabled={busy} onPress={onDismiss}>{t("dismiss")}</Button>
      </div>
    </aside>
  )
}
