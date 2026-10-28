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
    audienceLineOf,
    catalogBadgeOf,
    checkProvidersOf,
    connectionCountsOf,
} from "@/hooks/connection-catalog"
import type { CatalogEntry } from "@/hooks/connection-catalog"
import { connectionPageHref, sortRows, useConnectionOverlays, useWantConnector } from "@/hooks/connections"
import type { Connection, ConnectorAudience, ConnectorCategory } from "@/modules/types"
import { ConnectionLibraryBase } from "./component"
import type { LibraryCard, LibraryCategory, LibraryGroup } from "./component"

/** What the page hands the library. */
type ConnectionLibraryProps = {
    readonly items: ReadonlyArray<Connection>
    /** The workspace reads are not in yet: the tiles keep their shape with blank chips. */
    readonly isSkeleton?: boolean
}

type Audience = Exclude<ConnectorAudience, "any">
type Translate = ReturnType<typeof useTranslations<"connections">>

/** A catalog entry with its words resolved in the current locale. */
interface KnownEntry {
    readonly entry: CatalogEntry
    readonly name: string
    readonly blurb: string
    /** Name, blurb and keywords joined: what a search reads. */
    readonly haystack: string
}

/** Everything the library derives from the workspace connections and the controls. */
interface LibraryInput {
    readonly t: Translate
    readonly locale: string
    readonly items: ReadonlyArray<Connection>
    readonly text: string
    readonly category: ConnectorCategory | "all"
    readonly audience: Audience | "all"
    readonly sort: "popular" | "name"
    /** The "I need this" commands pressed so far: pending, done, or refused with a note. */
    readonly wants: Readonly<Record<string, LibraryCard["want"]>>
}

const IDLE_WANT: LibraryCard["want"] = { isPending: false, isDone: false }

const cardOf = (known: KnownEntry, input: LibraryInput): LibraryCard => {
    const { entry, name, blurb } = known
    const mine = entry.provider === undefined ? [] : input.items.filter((item) => item.provider === entry.provider)
    const count = connectionCountsOf(mine).get(entry.provider ?? "") ?? 0
    const needsCheck = entry.provider !== undefined && checkProvidersOf(mine).has(entry.provider)
    const first = sortRows(mine.filter((item) => item.status !== "disconnected"))[0]
    const href = first === undefined ? null : connectionPageHref(first)
    return {
        id: entry.id,
        name,
        blurb,
        audienceLine: audienceLineOf(entry, input.t),
        glyph: entry.glyph,
        ...(entry.logo === undefined ? {} : { logo: entry.logo }),
        ...(entry.provider === undefined ? {} : { guide: entry.provider }),
        badge: catalogBadgeOf(entry, count, input.t, needsCheck),
        isSoon: entry.status === "soon",
        want: input.wants[entry.id] ?? IDLE_WANT,
        ...(href === null ? {} : { href }),
        openLabel: name,
    }
}

/** The connectors that pass the search and the agent filter, in the chosen order, and the categories they fall in. */
const libraryOf = (input: LibraryInput) => {
    const { t, locale, text, audience, category, sort } = input
    const words = searchWords(text)
    const searched: ReadonlyArray<KnownEntry> = CATALOG.map((entry) => ({
        entry,
        name: t(catalogKey(entry, "name")),
        blurb: t(catalogKey(entry, "blurb")),
        haystack: `${t(catalogKey(entry, "name"))} ${t(catalogKey(entry, "blurb"))} ${t(catalogKey(entry, "keywords"))}`,
    })).filter((item) => passesFilters(item.entry, "all", audience) && matchesWords(item.haystack, words))
    const byName = (a: KnownEntry, b: KnownEntry) => a.name.localeCompare(b.name, locale)
    const byPopularity = (a: KnownEntry, b: KnownEntry) =>
        (b.entry.status === "soon" ? 0 : 1) - (a.entry.status === "soon" ? 0 : 1) ||
        b.entry.popularity - a.entry.popularity
    const ordered = [...searched].sort(sort === "name" ? byName : byPopularity)
    const perCategory = (id: ConnectorCategory) => searched.filter((item) => item.entry.category === id).length
    const categories: ReadonlyArray<LibraryCategory> = [
        { id: "all", label: t("libAllCategories"), count: searched.length },
        ...CATEGORIES.filter((id) => perCategory(id) > 0).map((id) => ({
            id,
            label: t(`cat_${id}`),
            count: perCategory(id),
        })),
    ]
    const groups: ReadonlyArray<LibraryGroup> = CATEGORIES.filter((id) => category === "all" || category === id)
        .map((id) => ({
            id,
            title: t(`cat_${id}`),
            cards: ordered.filter((item) => item.entry.category === id).map((item) => cardOf(item, input)),
        }))
        .filter((group) => group.cards.length > 0)
    return { categories, groups }
}

/**
 * The connector library tab: a category rail with counts, search (accents ignored), the agent filter and the sort, then the connectors
 * grouped by category. A tile opens the provider page of the connection when there is one, else the connector drawer through the
 * URL; a planned connector carries the "I need this" command.
 */
export const ConnectionLibrary = (props: ConnectionLibraryProps) => {
    const t = useTranslations("connections")
    const locale = useLocale()
    const overlays = useConnectionOverlays()
    const [text, setText] = useState("")
    const [category, setCategory] = useState<ConnectorCategory | "all">("all")
    const [audience, setAudience] = useState<Audience | "all">("all")
    const [sort, setSort] = useState<"popular" | "name">("popular")
    const [wants, setWants] = useState<Readonly<Record<string, LibraryCard["want"]>>>({})
    const want = useWantConnector()
    const askFor = (id: string) => {
        setWants((current) => ({ ...current, [id]: { isPending: true, isDone: false } }))
        void want(id).then((result) =>
            setWants((current) => ({
                ...current,
                [id]:
                    result.kind === "ok"
                        ? { isPending: false, isDone: true }
                        : { isPending: false, isDone: false, note: result.message },
            })),
        )
    }
    const { categories, groups } = useMemo(
        () => libraryOf({ t, locale, items: props.items, text, category, audience, sort, wants }),
        [t, locale, props.items, text, category, audience, sort, wants],
    )
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
                categories,
                audienceLabel: t("libAudience"),
                audience,
                audiences: [
                    { id: "all", label: t("libAnyAgent") },
                    ...AUDIENCES.map((id) => ({ id, label: t(`aud_${id}`) })),
                ],
                emptyMessage: t("libEmpty"),
                emptyHint: t("libEmptyHint"),
                wantLabel: t("libWant"),
                wantedLabel: t("libWanted"),
                groups,
                isSkeleton: props.isSkeleton ?? false,
            }}
            on={{
                text: setText,
                sort: (value) => setSort(value === "name" ? "name" : "popular"),
                category: (id) => setCategory(asCategory(id)),
                audience: (id) => setAudience(asAudience(id)),
                open: overlays.openDetail,
                want: askFor,
            }}
        />
    )
}
