"use client"

import { useMemo, useState } from "react"
import { Badge, Button, EmptyNotice, IconTile, Image, SearchField, Select, SurfaceCard, TagGroup, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connections as dict } from "@/i18n/dict/connections"
import type { Connection } from "@/lib/channels"
import { CATALOG, CATEGORIES, matches, type CatalogEntry, type ConnectorAudience, type ConnectorCategory } from "@/lib/connector-catalog"
import { PROVIDER_LOGO } from "@/lib/connection-providers"
import { nivoIconSource } from "@/ui"
import { LIBRARY_CARD_CLASS, LIBRARY_CARD_FOOT_CLASS, LIBRARY_CARD_HEAD_CLASS, LIBRARY_FILTERS_CLASS, LIBRARY_GRID_CLASS, PROVIDER_LOGO_CLASS, LIBRARY_SEARCH_CLASS, LIBRARY_SORT_CLASS, LIBRARY_TOOLBAR_CLASS } from "./classNames"

/** The connector's own logo when it has one, else its category glyph. */
export const ConnectorLogo = ({ entry }: { readonly entry: CatalogEntry }) => {
  const src = entry.logo ?? (entry.provider ? PROVIDER_LOGO[entry.provider] : undefined)
  return (
    <IconTile
      source={nivoIconSource(entry.glyph, "leading")} tone="neutral" size="md"
      artwork={src ? <Image src={src} alt="" aspect="square" fit="contain" width={28} height={28} className={PROVIDER_LOGO_CLASS} /> : undefined}
    />
  )
}

/** Props for {@link ConnectorLibrary}. */
export type ConnectorLibraryProps = {
  readonly items: ReadonlyArray<Connection>
  /** Open a connector's detail (its connections, what it brings, add or "want it"). */
  readonly onOpen: (entryId: string) => void
}

type Sort = "popular" | "name"
const AUDIENCES: ReadonlyArray<ConnectorAudience> = ["chatbot", "sales", "accounting"]

/**
 * The Connections library: every connector of the catalog, searchable (accents ignored), filtered by category and by the
 * agent it serves, sorted by popularity or name. A card shows the connector's status and how many connections the workspace
 * has of it; pressing it opens the detail. Built for a catalog of a hundred connectors: nothing here names one.
 */
export const ConnectorLibrary = ({ items, onOpen }: ConnectorLibraryProps) => {
  const t = useT(dict)
  const locale = useLocale()
  const [text, setText] = useState("")
  const [category, setCategory] = useState<ConnectorCategory | "all">("all")
  const [audience, setAudience] = useState<ConnectorAudience | "all">("all")
  const [sort, setSort] = useState<Sort>("popular")

  const countOf = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of items) if (c.status !== "disconnected") m.set(c.provider, (m.get(c.provider) ?? 0) + 1)
    return m
  }, [items])
  const perCategory = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of CATALOG) if (matches(e, { text, category: "all", audience })) m.set(e.category, (m.get(e.category) ?? 0) + 1)
    return m
  }, [text, audience])

  const shown = CATALOG.filter((e) => matches(e, { text, category, audience })).sort((a, b) =>
    sort === "name" ? a.name[locale].localeCompare(b.name[locale], locale) : (b.status === "soon" ? 0 : 1) - (a.status === "soon" ? 0 : 1) || b.popularity - a.popularity,
  )

  return (
    <div className={LIBRARY_FILTERS_CLASS}>
      <div className={LIBRARY_TOOLBAR_CLASS}>
        <div className={LIBRARY_SEARCH_CLASS}>
          <SearchField id="connector-search" label={t("libSearch")} isLabelHidden placeholder={t("libSearch")} value={text} onValueChange={setText} onClear={() => setText("")} clearLabel={t("libClear")} />
        </div>
        <div className={LIBRARY_SORT_CLASS}>
          <Select
            label={t("libSort")}
            isLabelHidden
            options={[{ id: "popular", label: t("libSortPopular") }, { id: "name", label: t("libSortName") }]}
            value={sort}
            onValueChange={(v) => setSort(v === "name" ? "name" : "popular")}
          />
        </div>
      </div>
      <TagGroup
        label={t("libCategory")}
        selectionMode="single"
        selectedIds={[category]}
        onSelectionChange={(ids: ReadonlyArray<string>) => setCategory((ids[0] as ConnectorCategory | "all" | undefined) ?? "all")}
        items={[
          { id: "all", label: t("libAll", { count: [...perCategory.values()].reduce((a, b) => a + b, 0) }) },
          ...CATEGORIES.filter((c) => (perCategory.get(c) ?? 0) > 0).map((c) => ({ id: c, label: `${t(`cat_${c}`)} · ${perCategory.get(c) ?? 0}` })),
        ]}
      />
      <TagGroup
          label={t("libAudience")}
          selectionMode="single"
          selectedIds={[audience]}
          onSelectionChange={(ids: ReadonlyArray<string>) => setAudience((ids[0] as ConnectorAudience | "all" | undefined) ?? "all")}
          items={[{ id: "all", label: t("libAnyAgent") }, ...AUDIENCES.map((a) => ({ id: a, label: t(`aud_${a}`) }))]}
        />
      {shown.length === 0 ? (
        <EmptyNotice message={t("libEmpty")} description={t("libEmptyHint")} />
      ) : (
        <div className={LIBRARY_GRID_CLASS}>
          {shown.map((e) => {
            const n = e.provider ? (countOf.get(e.provider) ?? 0) : 0
            return (
              <div key={e.id} {...(e.provider ? { "data-guide": `connections.${e.provider}` } : {})}>
                <SurfaceCard label={e.name[locale]} headingLevel={3}>
                  <div className={LIBRARY_CARD_CLASS}>
                    <div className={LIBRARY_CARD_HEAD_CLASS}>
                      <ConnectorLogo entry={e} />
                      <Text size="sm" tone="muted">{t(`cat_${e.category}`)}</Text>
                    </div>
                    <Text size="sm" tone="muted" overflow="clamp-2">{e.blurb[locale]}</Text>
                    <div className={LIBRARY_CARD_FOOT_CLASS}>
                      {n > 0 ? <Badge tone="success" isDot>{t("libConnected", { count: n })}</Badge>
                        : e.status === "soon" ? <Badge tone="neutral">{t("statusSoon")}</Badge>
                        : e.status === "early" ? <Badge tone="neutral">{t("statusEarly")}</Badge>
                        : null}
                      <Button variant="outline" size="sm" onPress={() => onOpen(e.id)}>
                        {e.status === "soon" ? t("libDetails") : n > 0 ? t("libManage") : t("connect")}
                      </Button>
                    </div>
                  </div>
                </SurfaceCard>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
