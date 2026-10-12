"use client"

import { Alert, Heading, List, ListItem, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationCardView } from "@/lib/automation-shared"
import { FACTS_CLASS, SECTION_CLASS } from "./classNames"
import { loc } from "./helpers"

/** Props for {@link GatePanel}. */
export type GatePanelProps = { readonly card: AutomationCardView; readonly onAnswerTrust: (accept: boolean) => void }

/** What happens to the message under the owner's authority, how it is written, and what NIVO always keeps. */
export const GatePanel = ({ card, onAnswerTrust }: GatePanelProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const def = card.def
  const sendsToCustomer = def.authority.action !== null
  const gateLine = card.gate === "auto" ? t("gateAuto") : card.gate === "ask" ? t("gateAsk") : card.gate === "never" ? t("gateNever") : null
  const modeLine = def.contentMode === "ai_per_case" ? t("modeAi") : def.contentMode === "fixed" ? t("modeFixed") : null

  return (
    <section className={SECTION_CLASS} aria-label={t("gateTitle")}>
      {sendsToCustomer ? (
        <div className={FACTS_CLASS}>
          <Heading level={3}>{t("gateTitle")}</Heading>
          {gateLine ? <Text size="sm">{gateLine}</Text> : null}
          {def.authority.alwaysAsk ? <Text size="sm">{t("alwaysAsk")}</Text> : null}
          {card.trust.autoSend ? <Text size="sm" tone="muted">{t("autoSendOn")}</Text> : null}
        </div>
      ) : null}
      {modeLine ? <Text size="sm" tone="muted">{modeLine}</Text> : null}
      {card.trust.offered && !card.trust.autoSend ? (
        <Alert
          title={t("trustOffer", { n: card.trust.streak })}
          tone="informative"
          action={{ label: t("trustYes"), onAction: () => onAnswerTrust(true) }}
          dismissLabel={t("trustNo")}
          onDismiss={() => onAnswerTrust(false)}
        />
      ) : null}
      {def.guardrails.length > 0 ? (
        <div className={FACTS_CLASS}>
          <Heading level={4}>{t("guardrailsTitle")}</Heading>
          <List className={FACTS_CLASS} label={t("guardrailsTitle")}>{def.guardrails.map((g, i) => <ListItem key={i}><Text size="sm">{loc(g, locale)}</Text></ListItem>)}</List>
        </div>
      ) : null}
    </section>
  )
}
