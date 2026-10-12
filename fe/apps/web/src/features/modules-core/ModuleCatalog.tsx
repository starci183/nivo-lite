"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Alert, Badge, Breadcrumbs, Button, EmptyNotice, Heading, Image, List, ListItem, PageContainer, SearchField, SectionHeader, SegmentedControl, Select, SurfaceCard, Text,
} from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { modulesCore } from "@/i18n/dict/modulesCore";
import { shell } from "@/i18n/dict/shell";
import { installModule } from "@/lib/module-actions";
import { MODULE_CATEGORIES, listModules, pick, pickList } from "@/lib/module-registry";
import type { ModuleDef } from "@/lib/module-registry";
import type { Installation, ModuleKey } from "@/lib/modules-shared";
import { STATUS_TONE, fold, isStatusFilter, statusOf, type StatusFilter } from "./meta";
import {
  BADGES_CLASS_NAME, CARD_CLASS_NAME, CARD_FOOT_CLASS_NAME, CARD_HEAD_CLASS_NAME, CARD_POINTS_CLASS_NAME, CATALOG_GRID_CLASS_NAME, CATEGORY_CLASS_NAME, PAGE_CLASS_NAME, HEAD_CLASS_NAME,
  TOOLBAR_CLASS_NAME, TOOLBAR_META_CLASS_NAME, TOOLBAR_ROW_CLASS_NAME, TOOLBAR_SEARCH_CLASS_NAME, TOOLBAR_SELECT_CLASS_NAME,
} from "./classNames";

type ModuleCatalogProps = {
  readonly installations: ReadonlyArray<Installation>;
  readonly canInstall: boolean;
  /** STATE-8: the same page while the installations load - the toolbar and the registry's cards stay real, each status, count and action is a skeleton. */
  readonly isLoading?: boolean;
};

const ALL_CATEGORIES = "all";
const SEARCH_URL_DELAY_MS = 250;

/** Everything a person can search an agent by, in both languages, folded (no accents, no case). */
const searchTextOf = (def: ModuleDef): string => {
  const category = MODULE_CATEGORIES.find((c) => c.key === def.category);
  return fold([
    def.name.vi, def.name.en, def.shortName.vi, def.shortName.en, def.description.vi, def.description.en,
    ...def.points.vi, ...def.points.en, category?.label.vi ?? "", category?.label.en ?? "",
  ].join(" "));
};
const SEARCH_TEXT = new Map<ModuleKey, string>(listModules().map((m) => [m.key, searchTextOf(m)]));

/** /agents: every module of the registry as a card, grouped by category, searchable and filterable (state in the URL). Install creates the module, its agent and the first setup session, then opens it. */
export const ModuleCatalog = ({ installations, canInstall, isLoading = false }: ModuleCatalogProps) => {
  const t = useT(modulesCore);
  const ts = useT(shell);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [busy, setBusy] = useState<ModuleKey | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [, startTransition] = useTransition();

  // The URL is the source of truth for status and category; the query keeps a local copy so typing never waits for the router.
  const urlQuery = params.get("q") ?? "";
  const statusParam = params.get("status");
  const status: StatusFilter = isStatusFilter(statusParam) ? statusParam : "all";
  const categoryParam = params.get("category");
  const category = MODULE_CATEGORIES.some((c) => c.key === categoryParam) ? (categoryParam as string) : ALL_CATEGORIES;
  const [query, setQuery] = useState(urlQuery);
  const writtenQuery = useRef(urlQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    // Back/forward changed the URL under us: follow it.
    if (urlQuery !== writtenQuery.current) { writtenQuery.current = urlQuery; setQuery(urlQuery); }
  }, [urlQuery]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const writeUrl = (next: { q?: string; status?: StatusFilter; category?: string }) => {
    const q = next.q ?? query;
    const st = next.status ?? status;
    const cat = next.category ?? category;
    const search = new URLSearchParams();
    if (q.trim() !== "") search.set("q", q);
    if (st !== "all") search.set("status", st);
    if (cat !== ALL_CATEGORIES) search.set("category", cat);
    const qs = search.toString();
    writtenQuery.current = q.trim() !== "" ? q : "";
    router.replace(qs === "" ? pathname : `${pathname}?${qs}`, { scroll: false });
  };
  const onQuery = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => writeUrl({ q: value }), SEARCH_URL_DELAY_MS);
  };
  const clearFilters = () => {
    clearTimeout(timer.current);
    setQuery("");
    writtenQuery.current = "";
    router.replace(pathname, { scroll: false });
  };

  const groups = useMemo(() => {
    const tokens = fold(query).split(/\s+/).filter((token) => token !== "");
    const installed = (key: ModuleKey) => installations.some((i) => i.moduleKey === key);
    const shown = listModules().filter((def) => {
      if (category !== ALL_CATEGORIES && def.category !== category) return false;
      // While the installations load nobody is known to be installed, so the install filters wait.
      if (!isLoading && status === "installed" && !installed(def.key)) return false;
      if (!isLoading && status === "notInstalled" && installed(def.key)) return false;
      if (status === "early" && def.status !== "early") return false;
      const haystack = SEARCH_TEXT.get(def.key) ?? "";
      return tokens.every((token) => haystack.includes(token));
    });
    // Installed agents first within a category, registry order otherwise (the sort is stable).
    return MODULE_CATEGORIES
      .map((c) => ({ category: c, modules: shown.filter((m) => m.category === c.key).sort((a, b) => Number(installed(b.key)) - Number(installed(a.key))) }))
      .filter((g) => g.modules.length > 0);
  }, [installations, isLoading, query, status, category]);
  const total = listModules().length;
  const count = groups.reduce((sum, g) => sum + g.modules.length, 0);
  const isFiltered = query.trim() !== "" || status !== "all" || category !== ALL_CATEGORIES;

  const onInstall = (key: ModuleKey) => {
    setError(undefined);
    setBusy(key);
    startTransition(async () => {
      const result = await installModule(key);
      if (!result.ok) { setError(result.error); setBusy(null); return; }
      router.push(`/agents/${key}`);
    });
  };

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <div className={HEAD_CLASS_NAME}>
          <Breadcrumbs label={ts("crumbLabel")} items={[{ id: "home", label: ts("crumbHome"), href: "/dashboard" }, { id: "modules", label: t("catalogTitle") }]} />
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("catalogTitle")} description={t("catalogDescription")} />
        </div>
        {error !== undefined ? <Alert title={t("installFailed")} description={error} tone="negative" /> : null}
        <div className={TOOLBAR_CLASS_NAME}>
          <div className={TOOLBAR_ROW_CLASS_NAME}>
            <div className={TOOLBAR_SEARCH_CLASS_NAME}>
              <SearchField
                label={t("filterSearch")} isLabelHidden placeholder={t("filterSearchPlaceholder")} clearLabel={t("filterClear")}
                value={query} onValueChange={onQuery} isSkeleton={isLoading}
              />
            </div>
            <div className={TOOLBAR_SELECT_CLASS_NAME}>
              <Select
                label={t("filterCategory")} isLabelHidden isSkeleton={isLoading}
                options={[{ id: ALL_CATEGORIES, label: t("filterCategoryAll") }, ...MODULE_CATEGORIES.map((c) => ({ id: c.key, label: pick(c.label, locale) }))]}
                value={category}
                onValueChange={(v) => writeUrl({ category: v ?? ALL_CATEGORIES })}
              />
            </div>
          </div>
          <div className={TOOLBAR_META_CLASS_NAME}>
            <SegmentedControl
              label={t("filterStatus")} isLabelHidden isSkeleton={isLoading}
              options={[
                { value: "all", label: t("filterStatusAll") },
                { value: "installed", label: t("filterStatusInstalled") },
                { value: "notInstalled", label: t("filterStatusNotInstalled") },
                { value: "early", label: t("filterStatusEarly") },
              ]}
              value={status}
              onValueChange={(v) => writeUrl({ status: isStatusFilter(v) ? v : "all" })}
            />
            <Text size="sm" tone="muted" live="polite" isSkeleton={isLoading}>{t("resultCount", { count, total })}</Text>
          </div>
        </div>
        {groups.length === 0 ? (
          <SurfaceCard ariaLabel={t("emptyTitle")}>
            <EmptyNotice
              message={t("emptyTitle")} description={t("emptyHint")}
              {...(isFiltered ? { actionLabel: t("emptyAction"), onAction: clearFilters } : {})}
            />
          </SurfaceCard>
        ) : null}
        {groups.map(({ category: group, modules }) => (
          <section key={group.key} className={CATEGORY_CLASS_NAME} aria-label={pick(group.label, locale)}>
            <Heading level={2}>{pick(group.label, locale)}</Heading>
            <div className={CATALOG_GRID_CLASS_NAME}>
              {modules.map((def) => {
                const key = def.key;
                const installation = installations.find((i) => i.moduleKey === key) ?? null;
                const shownStatus = statusOf(installation);
                return (
                  <SurfaceCard key={key} ariaLabel={pick(def.name, locale)}>
                    <div className={CARD_CLASS_NAME}>
                      <Image src={def.mascot} alt="" aspect="wide" fit="contain" plate="none" />
                      <div className={CARD_HEAD_CLASS_NAME}>
                        <Heading level={3}>{pick(def.name, locale)}</Heading>
                        <span className={BADGES_CLASS_NAME}>
                          {def.status === "early" ? <Badge tone="accent">{t("earlyBadge")}</Badge> : null}
                          <Badge isDot isSkeleton={isLoading} tone={STATUS_TONE[shownStatus]}>{t(`status_${shownStatus}`)}</Badge>
                        </span>
                      </div>
                      <Text size="sm" tone="muted">{pick(def.description, locale)}</Text>
                      <List label={pick(def.name, locale)} className={CARD_POINTS_CLASS_NAME}>
                        {pickList(def.points, locale).map((point) => (
                          <ListItem key={point}><Text size="sm" tone="muted">{point}</Text></ListItem>
                        ))}
                      </List>
                      {def.status === "early" ? <Text size="xs" tone="muted">{t("earlyHint")}</Text> : null}
                      <div className={CARD_FOOT_CLASS_NAME}>
                        {isLoading ? (
                          <Button variant="secondary" isSkeleton>{t("openModule")}</Button>
                        ) : installation !== null ? (
                          <Button variant="secondary" href={`/agents/${key}`}>{t("openModule")}</Button>
                        ) : canInstall ? (
                          <Button variant="primary" isPending={busy === key} isDisabled={busy !== null} onPress={() => onInstall(key)}>{t("install")}</Button>
                        ) : null}
                      </div>
                    </div>
                  </SurfaceCard>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </PageContainer>
  );
};
