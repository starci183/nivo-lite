"use client"

import type React from "react"

import { Badge, Icon, IconTile, Link, Switch, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { automations as dict } from "@/i18n/dict/automations"
import type { AutomationCardView } from "@/lib/automation-shared"
import { nivoIconSource } from "@/ui"
import { ACTIONS_CLASS, CARD_FOOT_CLASS, CARD_STACK_CLASS, CARD_TEXT_CLASS, CARD_TOP_CLASS } from "./classNames"
import { iconFor, loc, startsConnection, statusOf, switchLocked, type CardStatus } from "./helpers"

/** Props for {@link AutomationCard}. */
export type AutomationCardProps = {
  readonly card: AutomationCardView
  readonly selected: boolean
  readonly busy: boolean
  readonly onSelect: () => void
  readonly onToggle: (next: boolean) => void
  /** The card sits inside another bounded surface (the module Settings card): outline instead of elevation (BOUNDARY-5 case-1). */
  readonly isNested?: boolean
  /** Extra controls under the card text (the Google account picker of a Sheets automation). */
  readonly extra?: React.ReactNode
}

const TONE: Record<CardStatus, "success" | "neutral" | "warning" | "danger"> = {
  running: "success", off: "neutral", soon: "neutral", needsGoogle: "warning", needsWebhook: "warning", needsEmail: "warning", googleLost: "danger", googleUnavailable: "neutral", missing: "warning",
}
const LABEL: Record<CardStatus, "statusRunning" | "statusOff" | "statusSoon" | "statusNeedsGoogle" | "statusNeedsWebhook" | "statusNeedsEmail" | "statusMissing"> = {
  running: "statusRunning", off: "statusOff", soon: "statusSoon", needsGoogle: "statusNeedsGoogle", needsWebhook: "statusNeedsWebhook", needsEmail: "statusNeedsEmail", googleLost: "statusNeedsGoogle", googleUnavailable: "statusNeedsGoogle", missing: "statusMissing",
}

/**
 * STATE-8 case-2: one automation card while the collection loads - the resolved card's anatomy (icon tile, name, status,
 * description, trigger line, detail action, switch) as inert geometry.
 */
export const AutomationCardSkeleton = ({ isNested = false }: { readonly isNested?: boolean }) => {
  const t = useT(dict)
  return (
    <SurfaceCard ariaLabel={t("loading")} depth={isNested ? "nested" : "top"}>
      <div className={CARD_STACK_CLASS} aria-busy="true">
        <div className={CARD_TOP_CLASS}>
          <IconTile source={nivoIconSource("trigger", "leading")} tone="neutral" isSkeleton />
          <div className={CARD_TEXT_CLASS}>
            <Text weight="semibold" isSkeleton>{t("loading")}</Text>
            <div className={ACTIONS_CLASS}><Badge isDot tone="neutral" isSkeleton>{t("statusOff")}</Badge></div>
          </div>
        </div>
        <Text size="sm" tone="muted" isSkeleton>{t("loading")}</Text>
        <Text size="xs" tone="muted" isSkeleton>{t("loading")}</Text>
        <div className={CARD_FOOT_CLASS}>
          <TextAction appearance="disclosure" size="sm" isSkeleton>{t("selectHint")}</TextAction>
        </div>
      </div>
    </SurfaceCard>
  )
}

/**
 * One automation as one Grammar SurfaceCard: neutral icon tile, name, status, what it is, what starts it, and its switch.
 * "Xem chi tiết" selects it (the switch is a separate, disjoint control, STATE-5 case-4); the selected card carries the one accent sweep.
 */
export const AutomationCard = ({ card, selected, busy, onSelect, onToggle, isNested = false, extra }: AutomationCardProps) => {
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
        <Link href={first.href}>{loc(first.label, locale)}</Link>
      </Text>
    ) : status === "googleUnavailable" ? <Text size="xs" tone="muted">{t("googleUnavailable")}</Text>
    : status === "googleLost" ? <Text size="xs" tone="muted">{t("googleLost")}</Text>
    : status === "needsWebhook" ? <TextAction href="/developers" size="xs" appearance="inline">{t("connectWebhook")}</TextAction>
    : null

  return (
    <SurfaceCard ariaLabel={name} depth={isNested ? "nested" : "top"} isHighlight={selected}>
      <div className={CARD_STACK_CLASS} data-automation={card.key}>
        <div className={CARD_TOP_CLASS}>
          <IconTile source={nivoIconSource(iconFor(def), "leading")} tone="neutral" />
          <div className={CARD_TEXT_CLASS}>
            <Text weight="semibold">{name}</Text>
            <div className={ACTIONS_CLASS}><Badge isDot tone={TONE[status]}>{t(LABEL[status])}</Badge></div>
          </div>
        </div>
        <Text size="sm" tone="muted">{loc(def.description, locale)}</Text>
        <Text size="xs" tone="muted" startContent={<Icon source={nivoIconSource("trigger", "chip")} usage="chip" />}>{loc(def.trigger.line, locale)}</Text>
        {note}
        {card.sheetUrl ? <Text size="xs"><Link href={card.sheetUrl} kind="external">{t("openSheet")}</Link></Text> : null}
        {extra}
        <div className={CARD_FOOT_CLASS}>
          <TextAction appearance="disclosure" size="sm" isCurrent={selected} onPress={onSelect}>{t("selectHint")}</TextAction>
          <Switch
            name={`automation-${card.key}`}
            label={t("switchLabel")}
            isSelected={card.enabled}
            isDisabled={busy || switchLocked(status) || (!startsConnection(status) && card.missing.length > 0)}
            onSelectedChange={(next) => (startsConnection(status) ? onToggle(true) : onToggle(next))}
          />
        </div>
      </div>
    </SurfaceCard>
  )
}
