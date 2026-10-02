"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyNotice, SearchField, Select, SurfaceCard, Text } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { loyalty } from "@/i18n/dict/loyalty";
import type { LoyaltyWorkbenchData } from "@/lib/module-loyalty-queries";
import { displayPhone, formatVndShort, tierOf, type Member } from "@/lib/module-loyalty-shared";
import { FACTS_CLASS_NAME, FILTERS_CLASS_NAME, LIST_CLASS_NAME, MEMBER_ACTIVE_CLASS_NAME, MEMBER_BUTTON_CLASS_NAME, SPLIT_CLASS_NAME, CHIPS_CLASS_NAME, BODY_CLASS_NAME, DETAIL_CLASS_NAME } from "./classNames";
import { daysSince, formatNumber } from "./format";
import { MemberDetailPanel } from "./member-detail";
import { tierTone } from "./tier";

type SortKey = "points" | "lastVisit" | "spend";
const SORTS: ReadonlyArray<SortKey> = ["points", "lastVisit", "spend"];
const PAGE_SIZE = 50;

const fold = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

/** "Hôm nay", "3 ngày trước" or "Chưa mua". */
export const useLastVisit = (nowIso: string): ((iso: string | null) => string) => {
  const t = useT(loyalty);
  return (iso) => {
    if (!iso) return t("neverVisited");
    const d = daysSince(iso, nowIso);
    return d === 0 ? t("today") : t("daysAgo", { n: d });
  };
};

const sortValue = (m: Member, key: SortKey): number => (key === "points" ? m.points : key === "spend" ? m.lifetimeSpendVnd : m.lastVisitAt ? Date.parse(m.lastVisitAt) : 0);

/** Surface 2: the member list with search, tier filter and sort; a selected member opens the detail beside (desktop) or below (phone). */
export const MembersPanel = ({ data }: { readonly data: LoyaltyWorkbenchData }) => {
  const t = useT(loyalty);
  const locale = useLocale();
  const lastVisit = useLastVisit(data.nowIso);
  const cfg = data.program.config;
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [sort, setSort] = useState<SortKey>("lastVisit");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const q = fold(query.trim());
    const digits = query.replace(/\D/g, "");
    return data.members
      .filter((m) => (tier === "all" ? true : m.tierKey === tier))
      .filter((m) => !q || fold(m.name).includes(q) || (digits.length >= 3 && ((m.phone ?? "").includes(digits) || displayPhone(m.phone).replace(/D/g, "").includes(digits))))
      .sort((a, b) => sortValue(b, sort) - sortValue(a, sort));
  }, [data.members, query, tier, sort]);

  useEffect(() => setLimit(PAGE_SIZE), [query, tier, sort]);
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const tierOptions = [{ id: "all", label: t("filterAllTiers") }, ...cfg.tiers.map((x) => ({ id: x.key, label: x.name }))];
  const sortOptions = SORTS.map((k) => ({ id: k, label: t(`sort_${k}`) }));

  return (
    <div className={SPLIT_CLASS_NAME}>
      <SurfaceCard label={t("membersTitle")} headingLevel={2} labelEnd={<Text size="xs" tone="muted" live="polite">{t("membersCount", { n: rows.length })}</Text>}>
        <div className={FILTERS_CLASS_NAME}>
          <SearchField label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={query} onValueChange={setQuery} onClear={() => setQuery("")} />
          <Select label={t("filterTier")} options={tierOptions} value={tier} onValueChange={(v) => setTier(v ?? "all")} />
          <Select label={t("sortLabel")} options={sortOptions} value={sort} onValueChange={(v) => setSort(SORTS.find((k) => k === v) ?? "lastVisit")} />
        </div>
        {rows.length === 0 ? (
          <EmptyNotice message={data.members.length === 0 ? t("emptyMembersTitle") : t("noMatch")} description={data.members.length === 0 ? t("emptyMembersBodyStaff") : t("noMatchBody")} />
        ) : (
          <ul className={LIST_CLASS_NAME}>
            {rows.slice(0, limit).map((m) => {
              const tr = tierOf(cfg, m.tierKey);
              const isOn = m.id === selected;
              return (
                <li key={m.id}>
                  <button type="button" className={isOn ? `${MEMBER_BUTTON_CLASS_NAME} ${MEMBER_ACTIVE_CLASS_NAME}` : MEMBER_BUTTON_CLASS_NAME} aria-pressed={isOn} onClick={() => setSelected(m.id)}>
                    <div className={CHIPS_CLASS_NAME}>
                      <Text as="span" weight="semibold">{m.name}</Text>
                      {tr ? <Badge tone={tierTone(cfg, m.tierKey)}>{tr.name}</Badge> : null}
                    </div>
                    <Text size="sm" tone="muted">{displayPhone(m.phone) || t("noPhone")}</Text>
                    <div className={FACTS_CLASS_NAME}>
                      <Text as="span" size="sm" weight="medium">{t("points", { n: formatNumber(m.points, locale) })}</Text>
                      <Text as="span" size="sm" tone="muted">{lastVisit(m.lastVisitAt)}</Text>
                      <Text as="span" size="sm" tone="muted">{t("spentTotal", { value: formatVndShort(m.lifetimeSpendVnd) })}</Text>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length > limit ? (
          <div className={BODY_CLASS_NAME}>
            <div>
              <Button variant="outline" onPress={() => setLimit((n) => n + PAGE_SIZE)}>{t("showMore", { n: rows.length - limit })}</Button>
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      <div ref={detailRef} className={DETAIL_CLASS_NAME}>
        {selected ? (
          <MemberDetailPanel key={selected} id={selected} config={cfg} canManage={data.canManage} nowIso={data.nowIso} onClose={() => setSelected(null)} />
        ) : (
          <SurfaceCard ariaLabel={t("detailEmptyTitle")}>
            <EmptyNotice message={t("detailEmptyTitle")} description={t("detailEmptyBody")} />
          </SurfaceCard>
        )}
      </div>
    </div>
  );
};
