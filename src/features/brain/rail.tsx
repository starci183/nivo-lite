"use client"

import { Badge, List, ListBox, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { keyOf, visibleTo, type Fact, type Scope, type SubjectType } from "@/lib/brain/shared"
import { RAIL_LIST_CLASS, SIDE_CLASS, STACK_CLASS, START_ITEM_CLASS } from "./classNames"
import type { Lens, T } from "./shared"

const ALL = "all"

export type StarterPreset = { readonly subjectType: SubjectType; readonly subjectLabel: string; readonly attributeLabel: string; readonly scope: Scope }

/** The essentials customers ask about, each shown until a fact with that attribute exists. */
const starters = (t: T, business: string): Array<{ key: string; title: string; hint: string; preset: StarterPreset }> => [
  { key: "opening", title: t("sOpening"), hint: t("sOpeningHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sOpening"), scope: "public" } },
  { key: "address", title: t("sAddress"), hint: t("sAddressHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sAddress"), scope: "public" } },
  { key: "hotline", title: t("sHotline"), hint: t("sHotlineHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sHotline"), scope: "public" } },
  { key: "payment", title: t("sPayment"), hint: t("sPaymentHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sPayment"), scope: "public" } },
  { key: "booking", title: t("sBooking"), hint: t("sBookingHint"), preset: { subjectType: "policy", subjectLabel: t("sPolicy"), attributeLabel: t("sBooking"), scope: "public" } },
  { key: "returns", title: t("sReturns"), hint: t("sReturnsHint"), preset: { subjectType: "policy", subjectLabel: t("sPolicyReturns"), attributeLabel: t("sReturns"), scope: "public" } },
]

/** Props for {@link BrainRail}. */
export type BrainRailProps = {
  readonly facts: ReadonlyArray<Fact>
  readonly lenses: ReadonlyArray<Lens>
  readonly lens: Lens | null
  readonly onLens: (module: string | null) => void
  readonly business: string
  readonly canWrite: boolean
  readonly onStart: (preset: StarterPreset) => void
}

/** The side of Bộ não: who sees what (the lens), what is worth adding, and how the brain learns. */
export const BrainRail = ({ facts, lenses, lens, onLens, business, canWrite, onStart }: BrainRailProps) => {
  const t = useT(brain)
  const active = facts.filter((f) => f.status === "active")
  const have = new Set(active.map((f) => f.attribute))
  const missing = starters(t, business).filter((s) => !have.has(keyOf(s.preset.attributeLabel)))

  return (
    <div className={SIDE_CLASS}>
      <SurfaceCard label={t("lensTitle")} headingLevel={2}>
        <div className={STACK_CLASS}>
          <Text size="sm" tone="muted">{t("lensIntro")}</Text>
          <ListBox
            label={t("lensTitle")}
            selectionMode="single"
            selectedIds={[lens?.module ?? ALL]}
            onSelectionChange={(ids) => { const id = ids[0]; if (id) onLens(id === ALL ? null : id) }}
            items={[
              { id: ALL, label: t("lensAll"), description: t("lensAllHint"), trailing: <Badge tone="neutral">{String(active.length)}</Badge> },
              ...lenses.map((l) => ({
                id: l.module,
                label: l.name,
                description: l.audience === "customer" ? t("lensCustomer") : t("lensInternal"),
                trailing: <Badge tone={l.audience === "customer" ? "success" : "neutral"}>{t("lensSeen", { n: String(active.filter((f) => visibleTo(f, l.audience, l.module)).length), total: String(active.length) })}</Badge>,
              })),
            ]}
          />
        </div>
      </SurfaceCard>

      {canWrite ? (
        <SurfaceCard label={t("startTitle")} headingLevel={2}>
          <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">{missing.length ? t("startHint") : t("startAllDone")}</Text>
            {missing.length ? (
              <ListBox
                label={t("startTitle")}
                selectionMode="none"
                onAction={(id) => { const s = missing.find((m) => m.key === id); if (s) onStart(s.preset) }}
                items={missing.map((s) => ({ id: s.key, label: s.title, description: s.hint, trailing: <Text size="sm" tone="accent">{t("startAdd")}</Text> }))}
              />
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard label={t("howTitle")} headingLevel={2}>
        <List label={t("howTitle")} className={RAIL_LIST_CLASS}>
          {[t("how1"), t("how2"), t("how3")].map((line) => (
            <ListItem key={line} className={START_ITEM_CLASS}><Text size="sm">{line}</Text></ListItem>
          ))}
        </List>
      </SurfaceCard>
    </div>
  )
}
