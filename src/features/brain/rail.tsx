"use client"

import { Badge, Button, ListRow, StaticStateRow, SurfaceListCard } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { keyOf, visibleTo, type Fact, type Scope, type SubjectType } from "@/lib/brain/shared"
import { SIDE_CLASS } from "./classNames"
import type { Lens, T } from "./shared"

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
  /** STATE-8: each list card shows its three skeleton rows. */
  readonly isLoading?: boolean
  readonly onStart: (preset: StarterPreset) => void
}

/** The side of Bộ não: who sees what (the lens), what is worth adding, and how the brain learns. */
export const BrainRail = ({ facts, lenses, lens, onLens, business, canWrite, onStart, isLoading = false }: BrainRailProps) => {
  const t = useT(brain)
  const active = facts.filter((f) => f.status === "active")
  const have = new Set(active.map((f) => f.attribute))
  const missing = starters(t, business).filter((s) => !have.has(keyOf(s.preset.attributeLabel)))

  const views: ReadonlyArray<{ id: string; module: string | null; name: string; hint: string; count: string; tone: "success" | "neutral" }> = [
    { id: "all", module: null, name: t("lensAll"), hint: t("lensAllHint"), count: String(active.length), tone: "neutral" },
    ...lenses.map((l) => ({
      id: l.module,
      module: l.module,
      name: l.name,
      hint: l.audience === "customer" ? t("lensCustomer") : t("lensInternal"),
      count: t("lensSeen", { n: String(active.filter((f) => visibleTo(f, l.audience, l.module)).length), total: String(active.length) }),
      tone: l.audience === "customer" ? ("success" as const) : ("neutral" as const),
    })),
  ]

  return (
    <div className={SIDE_CLASS}>
      <SurfaceListCard label={t("lensTitle")} headingLevel={2} fact={t("lensIntro")} isLoading={isLoading}>
        {isLoading ? null : views.map((v) => {
          const isCurrent = (lens?.module ?? null) === v.module
          return (
            <ListRow
              key={v.id}
              title={v.name}
              description={v.hint}
              badges={<Badge tone={v.tone}>{v.count}</Badge>}
              actions={isCurrent
                ? <Badge tone="accent">{t("lensViewing")}</Badge>
                : <Button variant="ghost" size="sm" onPress={() => onLens(v.module)}>{t("lensView")}</Button>}
            />
          )
        })}
      </SurfaceListCard>

      {canWrite ? (
        <SurfaceListCard label={t("startTitle")} headingLevel={2} fact={isLoading ? t("startHint") : missing.length ? t("startHint") : t("startAllDone")} isLoading={isLoading}>
          {isLoading ? null : missing.map((s) => (
            <ListRow
              key={s.key}
              title={s.title}
              description={s.hint}
              actions={<Button variant="ghost" size="sm" onPress={() => onStart(s.preset)}>{t("startAdd")}</Button>}
            />
          ))}
        </SurfaceListCard>
      ) : null}

      <SurfaceListCard label={t("howTitle")} headingLevel={2}>
        {[t("how1"), t("how2"), t("how3")].map((line) => (
          <StaticStateRow key={line} item={{ id: line, label: line }} />
        ))}
      </SurfaceListCard>
    </div>
  )
}
