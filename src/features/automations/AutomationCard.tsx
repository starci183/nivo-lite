"use client"

import Link from "next/link"
import { Badge, Switch, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationCardView } from "@/lib/automation-shared"
import { NivoIcon } from "@/ui"
import { BoltIcon } from "./BoltIcon"
import { BOLT_CLASS, CARD_BUTTON_CLASS, CARD_CLASS, CARD_FOOT_CLASS, CARD_SELECTED_CLASS, CARD_TEXT_CLASS, CARD_TOP_CLASS, LINK_CLASS, TRIGGER_CLASS, tileClass } from "./classNames"
import { iconFor, loc, scopeOf, startsConnection, statusOf, switchLocked, type CardStatus } from "./helpers"

/** Props for {@link AutomationCard}. */
export type AutomationCardProps = {
  readonly card: AutomationCardView
  readonly selected: boolean
  readonly busy: boolean
  readonly onSelect: () => void
  readonly onToggle: (next: boolean) => void
}

const TONE: Record<CardStatus, "success" | "neutral" | "warning" | "danger"> = {
  running: "success", off: "neutral", soon: "neutral", needsGoogle: "warning", needsWebhook: "warning", needsEmail: "warning", googleLost: "danger", googleUnavailable: "neutral", missing: "warning",
}
const LABEL: Record<CardStatus, "statusRunning" | "statusOff" | "statusSoon" | "statusNeedsGoogle" | "statusNeedsWebhook" | "statusNeedsEmail" | "statusMissing"> = {
  running: "statusRunning", off: "statusOff", soon: "statusSoon", needsGoogle: "statusNeedsGoogle", needsWebhook: "statusNeedsWebhook", needsEmail: "statusNeedsEmail", googleLost: "statusNeedsGoogle", googleUnavailable: "statusNeedsGoogle", missing: "statusMissing",
}

/** One automation: module-coloured icon, name, what it is, what starts it, and its switch. Pressing the text selects it; the switch is separate. */
export const AutomationCard = ({ card, selected, busy, onSelect, onToggle }: AutomationCardProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const def = card.def
  const status = statusOf(card)
  const name = loc(def.name, locale)
  const first = card.missing[0]

  // The note under the text: why the switch cannot be pressed, or the one thing to fix.
  const note =
    status === "missing" ? (
      <Text size="xs" tone="muted">
        {t("missingLine", { items: card.missing.map((m) => loc(m.label, locale)).join(", ") })}{" "}
        <Link href={first.href} className={LINK_CLASS}>{loc(first.label, locale)}</Link>
      </Text>
    ) : status === "googleUnavailable" ? <Text size="xs" tone="muted">{t("googleUnavailable")}</Text>
    : status === "googleLost" ? <Text size="xs" tone="muted">{t("googleLost")}</Text>
    : status === "needsWebhook" ? <Link href="/developers" className={`${LINK_CLASS} text-xs`}>{t("connectWebhook")}</Link>
    : null

  return (
    <article className={selected ? CARD_SELECTED_CLASS : CARD_CLASS} data-automation={card.key}>
      <button type="button" className={CARD_BUTTON_CLASS} onClick={onSelect} aria-pressed={selected} aria-label={`${name}. ${t("selectHint")}`}>
        <span className={CARD_TOP_CLASS}>
          <span className={tileClass(scopeOf(def))} aria-hidden="true"><NivoIcon props={{ name: iconFor(def) }} /></span>
          <span className={CARD_TEXT_CLASS}>
            <Text weight="semibold">{name}</Text>
            <span><Badge isDot tone={TONE[status]}>{t(LABEL[status])}</Badge></span>
          </span>
        </span>
        <Text size="sm" tone="muted">{loc(def.description, locale)}</Text>
        <span className={TRIGGER_CLASS}><BoltIcon className={BOLT_CLASS} />{loc(def.trigger.line, locale)}</span>
      </button>
      {note}
      {card.sheetUrl ? <a className={`${LINK_CLASS} text-xs`} href={card.sheetUrl} target="_blank" rel="noreferrer">{t("openSheet")}</a> : null}
      <div className={CARD_FOOT_CLASS}>
        <span />
        <Switch
          name={`automation-${card.key}`}
          label={t("switchLabel")}
          isSelected={card.enabled}
          isDisabled={busy || switchLocked(status) || (!startsConnection(status) && card.missing.length > 0)}
          onSelectedChange={(next) => (startsConnection(status) ? onToggle(true) : onToggle(next))}
        />
      </div>
    </article>
  )
}
