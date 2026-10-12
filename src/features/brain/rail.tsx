"use client"

import { Badge, Button, ListRow, StaticStateRow, SurfaceListCard } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { brain } from "@/i18n/dict/brain"
import { keyOf, visibleTo, type Fact, type Scope, type SubjectType } from "@/lib/brain/shared"
import { SIDE_CLASS } from "./classNames"
import type { Lens, T } from "./shared"

export type StarterPreset = { readonly subjectType: SubjectType; readonly subjectLabel: string; readonly attributeLabel: string; readonly scope: Scope }

type Starter = { key: string; title: string; hint: string; preset: StarterPreset; /** Shown only while an agent of this module is active; omitted = always. */ module?: string }

/** The essentials customers ask about, each shown until a fact with that attribute exists. */
const essentials = (t: T, business: string): Array<Starter> => [
  { key: "opening", title: t("sOpening"), hint: t("sOpeningHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sOpening"), scope: "public" } },
  { key: "address", title: t("sAddress"), hint: t("sAddressHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sAddress"), scope: "public" } },
  { key: "hotline", title: t("sHotline"), hint: t("sHotlineHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sHotline"), scope: "public" } },
  { key: "payment", title: t("sPayment"), hint: t("sPaymentHint"), preset: { subjectType: "business", subjectLabel: business, attributeLabel: t("sPayment"), scope: "public" } },
  { key: "booking", title: t("sBooking"), hint: t("sBookingHint"), preset: { subjectType: "policy", subjectLabel: t("sPolicy"), attributeLabel: t("sBooking"), scope: "public" } },
  { key: "returns", title: t("sReturns"), hint: t("sReturnsHint"), preset: { subjectType: "policy", subjectLabel: t("sPolicyReturns"), attributeLabel: t("sReturns"), scope: "public" } },
]

/** Key facts of each module, so one click opens the form with the subject, attribute and visibility already set. */
const moduleStarters = (t: T): Array<Starter> => [
  { module: "booking", key: "BkServices", title: t("sxBkServices"), hint: t("sxBkServicesHint"), preset: { subjectType: "service", subjectLabel: t("sSubjService"), attributeLabel: t("sxBkServices"), scope: "public" } },
  { module: "booking", key: "BkStaff", title: t("sxBkStaff"), hint: t("sxBkStaffHint"), preset: { subjectType: "person", subjectLabel: t("sSubjStaff"), attributeLabel: t("sxBkStaff"), scope: "internal" } },
  { module: "booking", key: "BkExceptions", title: t("sxBkExceptions"), hint: t("sxBkExceptionsHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjPolicy"), attributeLabel: t("sxBkExceptions"), scope: "public" } },
  { module: "loyalty", key: "LyEarn", title: t("sxLyEarn"), hint: t("sxLyEarnHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLoyalty"), attributeLabel: t("sxLyEarn"), scope: "public" } },
  { module: "loyalty", key: "LyRewards", title: t("sxLyRewards"), hint: t("sxLyRewardsHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLoyalty"), attributeLabel: t("sxLyRewards"), scope: "public" } },
  { module: "loyalty", key: "LyTiers", title: t("sxLyTiers"), hint: t("sxLyTiersHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLoyalty"), attributeLabel: t("sxLyTiers"), scope: "public" } },
  { module: "loyalty", key: "LyExpiry", title: t("sxLyExpiry"), hint: t("sxLyExpiryHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLoyalty"), attributeLabel: t("sxLyExpiry"), scope: "public" } },
  { module: "inventory", key: "InSuppliers", title: t("sxInSuppliers"), hint: t("sxInSuppliersHint"), preset: { subjectType: "supplier", subjectLabel: t("sSubjSupplier"), attributeLabel: t("sxInSuppliers"), scope: "internal" } },
  { module: "inventory", key: "InReorder", title: t("sxInReorder"), hint: t("sxInReorderHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjStock"), attributeLabel: t("sxInReorder"), scope: "internal" } },
  { module: "inventory", key: "InUnits", title: t("sxInUnits"), hint: t("sxInUnitsHint"), preset: { subjectType: "other", subjectLabel: t("sSubjStock"), attributeLabel: t("sxInUnits"), scope: "internal" } },
  { module: "shifts", key: "ShPay", title: t("sxShPay"), hint: t("sxShPayHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjRoster"), attributeLabel: t("sxShPay"), scope: "internal" } },
  { module: "shifts", key: "ShRules", title: t("sxShRules"), hint: t("sxShRulesHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjRoster"), attributeLabel: t("sxShRules"), scope: "internal" } },
  { module: "shifts", key: "ShLeave", title: t("sxShLeave"), hint: t("sxShLeaveHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjRoster"), attributeLabel: t("sxShLeave"), scope: "internal" } },
  { module: "hiring", key: "HrRoles", title: t("sxHrRoles"), hint: t("sxHrRolesHint"), preset: { subjectType: "other", subjectLabel: t("sSubjHiring"), attributeLabel: t("sxHrRoles"), scope: "public" } },
  { module: "hiring", key: "HrProcess", title: t("sxHrProcess"), hint: t("sxHrProcessHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjHiring"), attributeLabel: t("sxHrProcess"), scope: "internal" } },
  { module: "hiring", key: "HrBenefits", title: t("sxHrBenefits"), hint: t("sxHrBenefitsHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjHiring"), attributeLabel: t("sxHrBenefits"), scope: "internal" } },
  { module: "hiring", key: "HrSalary", title: t("sxHrSalary"), hint: t("sxHrSalaryHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjHiring"), attributeLabel: t("sxHrSalary"), scope: "restricted" } },
  { module: "content", key: "CtPillars", title: t("sxCtPillars"), hint: t("sxCtPillarsHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjMarketing"), attributeLabel: t("sxCtPillars"), scope: "internal" } },
  { module: "content", key: "CtBanned", title: t("sxCtBanned"), hint: t("sxCtBannedHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjMarketing"), attributeLabel: t("sxCtBanned"), scope: "internal" } },
  { module: "content", key: "CtOffers", title: t("sxCtOffers"), hint: t("sxCtOffersHint"), preset: { subjectType: "other", subjectLabel: t("sSubjOffers"), attributeLabel: t("sxCtOffers"), scope: "internal" } },
  { module: "video", key: "VdBrand", title: t("sxVdBrand"), hint: t("sxVdBrandHint"), preset: { subjectType: "business", subjectLabel: t("sSubjVideo"), attributeLabel: t("sxVdBrand"), scope: "internal" } },
  { module: "video", key: "VdOffers", title: t("sxVdOffers"), hint: t("sxVdOffersHint"), preset: { subjectType: "product", subjectLabel: t("sSubjOffers"), attributeLabel: t("sxVdOffers"), scope: "public" } },
  { module: "lead_gen", key: "LgIcp", title: t("sxLgIcp"), hint: t("sxLgIcpHint"), preset: { subjectType: "customer", subjectLabel: t("sSubjLeads"), attributeLabel: t("sxLgIcp"), scope: "internal" } },
  { module: "lead_gen", key: "LgQuestions", title: t("sxLgQuestions"), hint: t("sxLgQuestionsHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLeads"), attributeLabel: t("sxLgQuestions"), scope: "internal" } },
  { module: "lead_gen", key: "LgScoring", title: t("sxLgScoring"), hint: t("sxLgScoringHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLeads"), attributeLabel: t("sxLgScoring"), scope: "internal" } },
  { module: "lead_gen", key: "LgObjections", title: t("sxLgObjections"), hint: t("sxLgObjectionsHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLeads"), attributeLabel: t("sxLgObjections"), scope: "internal" } },
  { module: "lead_gen", key: "LgOffers", title: t("sxLgOffers"), hint: t("sxLgOffersHint"), preset: { subjectType: "product", subjectLabel: t("sSubjOffers"), attributeLabel: t("sxLgOffers"), scope: "public" } },
  { module: "lead_gen", key: "LgForbidden", title: t("sxLgForbidden"), hint: t("sxLgForbiddenHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLeads"), attributeLabel: t("sxLgForbidden"), scope: "internal" } },
  { module: "lead_gen", key: "LgRouting", title: t("sxLgRouting"), hint: t("sxLgRoutingHint"), preset: { subjectType: "policy", subjectLabel: t("sSubjLeads"), attributeLabel: t("sxLgRouting"), scope: "internal" } },
]

const starters = (t: T, business: string, modules: ReadonlySet<string>): Array<Starter> =>
  [...essentials(t, business), ...moduleStarters(t).filter((s) => s.module !== undefined && modules.has(s.module))]

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
  const missing = starters(t, business, new Set(lenses.map((l) => l.module))).filter((s) => !have.has(keyOf(s.preset.attributeLabel)))

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
