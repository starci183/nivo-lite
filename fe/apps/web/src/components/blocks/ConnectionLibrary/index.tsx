"use client"

import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import {
    CATALOG,
    CATEGORIES,
    CURRENT_CONNECTORS,
    catalogKey,
    matchesWords,
    searchWords,
    asCategory,
    audienceLineOf,
    catalogStatusOf,
    catalogTagOf,
    checkProvidersOf,
    connectionCountsOf,
} from "@/hooks/connection-catalog"
import type { CatalogEntry } from "@/hooks/connection-catalog"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import { useConnectionOverlays, useWantConnector } from "@/hooks/connections"
import type { Connection, ConnectorCategory } from "@/modules/types"
import { ConnectionLibraryBase } from "./component"
import type { LibraryCard, LibraryCategory } from "./component"

/** What the page hands the library. */
type ConnectionLibraryProps = {
    readonly items: ReadonlyArray<Connection>
    /** The workspace reads are not in yet: the tiles keep their shape with blank chips. */
    readonly isSkeleton?: boolean
}

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
    readonly items: ReadonlyArray<Connection>
    readonly text: string
    readonly category: ConnectorCategory | "all"
    /** The "I need this" commands pressed so far: pending, done, or refused with a note. */
    readonly wants: Readonly<Record<string, LibraryCard["want"]>>
}

const IDLE_WANT: LibraryCard["want"] = { isPending: false, isDone: false }

const cardOf = (known: KnownEntry, input: LibraryInput): LibraryCard => {
    const { entry, name, blurb } = known
    const logo = entry.logo ?? (entry.provider === undefined ? undefined : PROVIDER_LOGO[entry.provider])
    const mine = entry.provider === undefined ? [] : input.items.filter((item) => item.provider === entry.provider)
    const count = connectionCountsOf(mine).get(entry.provider ?? "") ?? 0
    const needsCheck = entry.provider !== undefined && checkProvidersOf(mine).has(entry.provider)
    return {
        id: entry.id,
        name,
        blurb,
        audienceLine: audienceLineOf(entry, input.t),
        glyph: entry.glyph,
        ...(logo === undefined ? {} : { logo }),
        ...(entry.provider === undefined ? {} : { guide: entry.provider }),
        tag: catalogTagOf(entry, input.t),
        status: catalogStatusOf(count, input.t, needsCheck),
        connected: count,
        isCurrent: CURRENT_CONNECTORS.includes(entry.id),
        isSoon: entry.status === "soon",
        want: input.wants[entry.id] ?? IDLE_WANT,
    }
}

/** The connectors that pass the search, most used first and planned ones last, and the categories the search leaves with their counts. */
const libraryOf = (input: LibraryInput) => {
    const { t, text, category } = input
    const words = searchWords(text)
    const searched: ReadonlyArray<KnownEntry> = CATALOG.map((entry) => ({
        entry,
        name: t(catalogKey(entry, "name")),
        blurb: t(catalogKey(entry, "blurb")),
        haystack: `${t(catalogKey(entry, "name"))} ${t(catalogKey(entry, "blurb"))} ${t(catalogKey(entry, "keywords"))}`,
    })).filter((item) => matchesWords(item.haystack, words))
    const rankOf = (item: KnownEntry): number => {
        const current = CURRENT_CONNECTORS.indexOf(item.entry.id)
        return current === -1 ? CURRENT_CONNECTORS.length : current
    }
    const byPopularity = (a: KnownEntry, b: KnownEntry) =>
        rankOf(a) - rankOf(b) ||
        (b.entry.status === "soon" ? 0 : 1) - (a.entry.status === "soon" ? 0 : 1) ||
        b.entry.popularity - a.entry.popularity
    const perCategory = (id: ConnectorCategory) => searched.filter((item) => item.entry.category === id).length
    const categories: ReadonlyArray<LibraryCategory> = [
        { id: "all", label: t("libAllCategories"), count: searched.length },
        ...CATEGORIES.filter((id) => perCategory(id) > 0).map((id) => ({
            id,
            label: t(`cat_${id}`),
            count: perCategory(id),
        })),
    ]
    const cards = [...searched]
        .filter((item) => category === "all" || item.entry.category === category)
        .sort(byPopularity)
        .map((item) => cardOf(item, input))
    return { categories, cards }
}

/**
 * The connector library tab: the search (accents ignored) and the category chips with counts, then one grid of the connectors that
 * pass both. A tile opens the provider page of the connection when there is one, else the connector drawer through the
 * URL; a planned connector carries the "I need this" command.
 */
export const ConnectionLibrary = (props: ConnectionLibraryProps) => {
    const t = useTranslations("connections")
    const overlays = useConnectionOverlays()
    const [text, setText] = useState("")
    const [category, setCategory] = useState<ConnectorCategory | "all">("all")
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
    const { categories, cards } = useMemo(
        () => libraryOf({ t, items: props.items, text, category, wants }),
        [t, props.items, text, category, wants],
    )
    return (
        <ConnectionLibraryBase
            props={{
                text,
                searchLabel: t("libSearch"),
                clearLabel: t("libClear"),
                filterLabel: t("libFilter"),
                category,
                categories,
                emptyMessage: t("libEmpty"),
                emptyHint: t("libEmptyHint"),
                wantLabel: t("libWant"),
                wantedLabel: t("libWanted"),
                connectLabel: t("libConnect"),
                addLabel: t("libAddAnother"),
                currentLabel: t("libCurrent"),
                othersLabel: t("libOthers"),
                cards,
                isSkeleton: props.isSkeleton ?? false,
            }}
            on={{
                text: setText,
                category: (id) => setCategory(asCategory(id)),
                open: overlays.openDetail,
                want: askFor,
            }}
        />
    )
}
