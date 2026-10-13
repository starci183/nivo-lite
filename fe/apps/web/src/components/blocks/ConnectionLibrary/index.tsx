"use client"

import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import {
    AUDIENCES,
    CATALOG,
    CATEGORIES,
    catalogKey,
    matchesWords,
    passesFilters,
    searchWords,
} from "@/hooks/connection-catalog"
import type { CatalogEntry } from "@/hooks/connection-catalog"
import { useConnectionOverlays } from "@/hooks/connections"
import type { Connection, ConnectorAudience, ConnectorCategory } from "@/modules/types"
import { ConnectionLibraryBase } from "./component"
import type { LibraryBadge, LibraryCard } from "./component"

/** What the page hands the library. */
type ConnectionLibraryProps = {
    readonly items: ReadonlyArray<Connection>
    /** STATE-8: the catalog is known, the workspace connection counts are not. */
    readonly isLoading?: boolean
}

type Audience = Exclude<ConnectorAudience, "any">
type Translate = (key: string, values?: Record<string, string | number>) => string

const asCategory = (id: string): ConnectorCategory | "all" => CATEGORIES.find((category) => category === id) ?? "all"
const asAudience = (id: string): Audience | "all" => AUDIENCES.find((audience) => audience === id) ?? "all"

const badgeOf = (entry: CatalogEntry, count: number, t: Translate): LibraryBadge | null => {
    if (count > 0) return { tone: "success", label: t("libConnected", { count }), isDot: true }
    if (entry.status === "soon") return { tone: "neutral", label: t("statusSoon"), isDot: false }
    return entry.status === "early" ? { tone: "neutral", label: t("statusEarly"), isDot: false } : null
}

const actionOf = (entry: CatalogEntry, count: number, t: Translate): string => {
    if (entry.status === "soon") return t("libDetails")
    return count > 0 ? t("libManage") : t("connect")
}

/**
 * The connector library tab: search (accents ignored), category and agent filters, sort by popularity or name. Pressing a card opens
 * the connector's detail drawer through the URL, so the library never needs to know who draws it.
 */
export const ConnectionLibrary = (props: ConnectionLibraryProps) => {
    const t = useTranslations("connections")
    const locale = useLocale()
    const overlays = useConnectionOverlays()
    const [text, setText] = useState("")
    const [category, setCategory] = useState<ConnectorCategory | "all">("all")
    const [audience, setAudience] = useState<Audience | "all">("all")
    const [sort, setSort] = useState<"popular" | "name">("popular")

    const countOf = useMemo(() => {
        const counts = new Map<string, number>()
        for (const connection of props.items) {
            if (connection.status !== "disconnected")
                counts.set(connection.provider, (counts.get(connection.provider) ?? 0) + 1)
        }
        return counts
    }, [props.items])
    const words = searchWords(text)
    const known = CATALOG.map((entry) => ({
        entry,
        name: t(catalogKey(entry, "name")),
        blurb: t(catalogKey(entry, "blurb")),
        keywords: t(catalogKey(entry, "keywords")),
    }))
    const searched = known.filter(
        (item) =>
            passesFilters(item.entry, "all", audience) &&
            matchesWords(`${item.name} ${item.blurb} ${item.keywords}`, words),
    )
    const perCategory = (id: ConnectorCategory) => searched.filter((item) => item.entry.category === id).length
    const byName = (a: (typeof known)[number], b: (typeof known)[number]) => a.name.localeCompare(b.name, locale)
    const byPopularity = (a: (typeof known)[number], b: (typeof known)[number]) =>
        (b.entry.status === "soon" ? 0 : 1) - (a.entry.status === "soon" ? 0 : 1) ||
        b.entry.popularity - a.entry.popularity
    const shown = searched
        .filter((item) => category === "all" || item.entry.category === category)
        .sort(sort === "name" ? byName : byPopularity)

    const isLoading = props.isLoading ?? false
    const cards: ReadonlyArray<LibraryCard> = shown.map(({ entry, name, blurb }) => {
        const count = entry.provider === undefined ? 0 : (countOf.get(entry.provider) ?? 0)
        const badge =
            badgeOf(entry, count, t) ??
            (isLoading ? { tone: "neutral" as const, label: t("statusSoon"), isDot: false } : null)
        return {
            id: entry.id,
            name,
            blurb,
            categoryLabel: t(`cat_${entry.category}`),
            glyph: entry.glyph,
            ...(entry.logo === undefined ? {} : { logo: entry.logo }),
            ...(entry.provider === undefined ? {} : { guide: entry.provider }),
            badge,
            actionLabel: actionOf(entry, count, t),
        }
    })

    return (
        <ConnectionLibraryBase
            props={{
                text,
                searchLabel: t("libSearch"),
                clearLabel: t("libClear"),
                sort,
                sortLabel: t("libSort"),
                sortOptions: [
                    { id: "popular", label: t("libSortPopular") },
                    { id: "name", label: t("libSortName") },
                ],
                categoryLabel: t("libCategory"),
                category,
                categories: [
                    { id: "all", label: t("libAll", { count: searched.length }) },
                    ...CATEGORIES.filter((id) => perCategory(id) > 0).map((id) => ({
                        id,
                        label: `${t(`cat_${id}`)} · ${perCategory(id)}`,
                    })),
                ],
                audienceLabel: t("libAudience"),
                audience,
                audiences: [
                    { id: "all", label: t("libAnyAgent") },
                    ...AUDIENCES.map((id) => ({ id, label: t(`aud_${id}`) })),
                ],
                emptyMessage: t("libEmpty"),
                emptyHint: t("libEmptyHint"),
                cards,
                isLoading,
            }}
            on={{
                text: setText,
                sort: (value) => setSort(value === "name" ? "name" : "popular"),
                category: (id) => setCategory(asCategory(id)),
                audience: (id) => setAudience(asAudience(id)),
                open: overlays.openDetail,
            }}
        />
    )
}
