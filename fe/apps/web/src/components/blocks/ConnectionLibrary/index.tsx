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
    asCategory,
    asAudience,
    catalogBadgeOf,
    connectionCountsOf,
    actionOf,
} from "@/hooks/connection-catalog"

import { useConnectionOverlays } from "@/hooks/connections"
import type { Connection, ConnectorAudience, ConnectorCategory } from "@/modules/types"
import { ConnectionLibraryBase, type LibraryCard } from "./component"

/** What the page hands the library. */
type ConnectionLibraryProps = {
    readonly items: ReadonlyArray<Connection>
    /** STATE-8: the catalog is known, the workspace connection counts are not. */
    readonly isLoading?: boolean
}

type Audience = Exclude<ConnectorAudience, "any">
/**
 * The connector library tab: search (accents ignored), category and agent filters, sort by popularity or name. Pressing a card opens
 * the connector's detail drawer through the URL, so the library never needs to know who draws it.
 */
/** Inputs for the connected state mapping. */
interface BuildConnectionLibraryStateInput {
    readonly text: string
    readonly t: ReturnType<typeof useTranslations<"connections">>
    readonly audience: Audience | "all"
    readonly locale: ReturnType<typeof useLocale>
    readonly category: ConnectorCategory | "all"
    readonly sort: "popular" | "name"
    readonly isLoading: boolean
    readonly countOf: Map<string, number>
    readonly setText: import("react").Dispatch<import("react").SetStateAction<string>>
    readonly setSort: import("react").Dispatch<import("react").SetStateAction<"popular" | "name">>
    readonly setCategory: import("react").Dispatch<import("react").SetStateAction<ConnectorCategory | "all">>
    readonly setAudience: import("react").Dispatch<import("react").SetStateAction<Audience | "all">>
    readonly overlays: ReturnType<typeof useConnectionOverlays>
}

/** Derives display values and interactions from the supplied state. */
const buildConnectionLibraryState = ({
    text,
    t,
    audience,
    locale,
    category,
    sort,
    isLoading,
    countOf,
    setText,
    setSort,
    setCategory,
    setAudience,
    overlays,
}: BuildConnectionLibraryStateInput) => {
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
    const cards: ReadonlyArray<LibraryCard> = shown.map(({ entry, name, blurb }) => {
        const count = entry.provider === undefined ? 0 : (countOf.get(entry.provider) ?? 0)
        const badge =
            catalogBadgeOf(entry, count, t) ??
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
    return {
        setText,
        setSort,
        setCategory,
        setAudience,
        overlays,
        text,
        t,
        sort,
        category,
        searched,
        perCategory,
        audience,
        cards,
        isLoading,
    }
}

/** Draws the connected view from its current state. */
export const ConnectionLibrary = (props: ConnectionLibraryProps) => {
    const t = useTranslations("connections")
    const locale = useLocale()
    const overlays = useConnectionOverlays()
    const [text, setText] = useState("")
    const [category, setCategory] = useState<ConnectorCategory | "all">("all")
    const [audience, setAudience] = useState<Audience | "all">("all")
    const [sort, setSort] = useState<"popular" | "name">("popular")
    const countOf = useMemo(() => connectionCountsOf(props.items), [props.items])

    const connected = buildConnectionLibraryState({
        text,
        t,
        audience,
        locale,
        category,
        sort,
        isLoading: props.isLoading ?? false,
        countOf,
        setText,
        setSort,
        setCategory,
        setAudience,
        overlays,
    })
    if (connected === null) return null

    return (
        <ConnectionLibraryBase
            props={connectionLibraryProps(connected)}
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

/** Builds the props supplied to ConnectionLibraryBase. */
const connectionLibraryProps = (
    connected: NonNullable<ReturnType<typeof buildConnectionLibraryState>>,
): Parameters<typeof ConnectionLibraryBase>[0]["props"] => {
    const { text, t, sort, category, searched, perCategory, audience, cards, isLoading } = connected
    return {
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
                label: `${t("cat_" + id)} · ${perCategory(id)}`,
            })),
        ],
        audienceLabel: t("libAudience"),
        audience,
        audiences: [{ id: "all", label: t("libAnyAgent") }, ...AUDIENCES.map((id) => ({ id, label: t(`aud_${id}`) }))],
        emptyMessage: t("libEmpty"),
        emptyHint: t("libEmptyHint"),
        cards,
        isLoading,
    }
}
