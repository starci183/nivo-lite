"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import {
    CATALOG,
    CURRENT_CONNECTORS,
    catalogKey,
    matchesWords,
    searchWords,
    asGroup,
    FOLDED_CONNECTORS,
    groupOfEntry,
    providersOfEntry,
    unitOfEntry,
    audienceLineOf,
    catalogTagOf,
    connectionCountsOf,
    useLibraryLife,
    type CatalogEntry,
} from "@/hooks/connection-catalog"
import { PROVIDER_LOGO } from "@/hooks/connection-providers"
import {
    mayConnect,
    useConnectionOverlays,
    useConnectionsData,
    useConnectionsRole,
    useWantConnector,
} from "@/hooks/connections"
import type { Connection, LibraryCard, LibraryCategory } from "@/modules/types"
import { ConnectionLibraryBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

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
    readonly workspaceId: string
    readonly t: Translate
    readonly items: ReadonlyArray<Connection>
    readonly text: string
    readonly group: string
    /** The "I need this" commands pressed so far: pending, done, or refused with a note. */
    readonly wants: Readonly<Record<string, LibraryCard["want"]>>
    /** The viewer's role in the workspace. */
    readonly role: string | undefined
    /** The tile status of a connector from the workspace's connections of it. */
    readonly lifeOf: ReturnType<typeof useLibraryLife>
}

/** The line beside a tile's name: a planned connector says so; another one what it holds many of, with its early-access tag. */
const bylineOf = (isSoon: boolean, many: string, tag: string | undefined): string => {
    if (isSoon) return tag ?? ""
    return tag === undefined ? many : `${many} · ${tag}`
}

/** The groups of the library, in the order they head it. */
const GROUP_ORDER: ReadonlyArray<string> = ["chat", "money", "google", "data", "sales", "accounting"]

const IDLE_WANT: LibraryCard["want"] = { isPending: false, isDone: false }

const cardOf = (known: KnownEntry, input: LibraryInput): LibraryCard => {
    const { entry, name, blurb } = known
    const logo = entry.logo ?? (entry.provider === undefined ? undefined : PROVIDER_LOGO[entry.provider])
    const providers = providersOfEntry(entry)
    const mine = input.items.filter((item) => providers.includes(item.provider))
    const counts = connectionCountsOf(mine)
    const count = providers.reduce((sum, provider) => sum + (counts.get(provider) ?? 0), 0)
    const unit = unitOfEntry(entry)
    const life = input.lifeOf(mine, unit)
    const tag = catalogTagOf(entry, input.t)
    return {
        id: entry.id,
        name,
        blurb,
        audienceLine: audienceLineOf(entry, input.t),
        glyph: entry.glyph,
        ...(logo === undefined ? {} : { logo }),
        ...(entry.provider === undefined ? {} : { guide: entry.provider }),
        tag,
        status: life.status,
        ...(life.lifeAction === undefined ? {} : { lifeAction: life.lifeAction }),
        connected: count,
        isCurrent: CURRENT_CONNECTORS.includes(entry.id),
        group: groupOfEntry(entry),
        byline: bylineOf(entry.status === "soon", input.t(`many_${unit}`), tag?.label),
        addLabel: input.t(`add_${unit}`),
        isSoon: entry.status === "soon",
        canConnect: entry.provider !== undefined && mayConnect(input.role, entry.provider),
        want: input.wants[entry.id] ?? IDLE_WANT,
    }
}

/** The connectors that pass the search, most used first and planned ones last, and the categories the search leaves with their counts. */
const libraryOf = (input: LibraryInput) => {
    const { t, text, group } = input
    const words = searchWords(text)
    const searched: ReadonlyArray<KnownEntry> = CATALOG.filter((entry) => !FOLDED_CONNECTORS.has(entry.id))
        .map((entry) => ({
            entry,
            name: t(catalogKey(entry, "name")),
            blurb: t(catalogKey(entry, "blurb")),
            haystack: `${t(catalogKey(entry, "name"))} ${t(catalogKey(entry, "blurb"))} ${t(catalogKey(entry, "keywords"))}`,
        }))
        .filter((item) => matchesWords(item.haystack, words))
    const rankOf = (item: KnownEntry): number => {
        const current = CURRENT_CONNECTORS.indexOf(item.entry.id)
        return current === -1 ? CURRENT_CONNECTORS.length : current
    }
    const byPopularity = (a: KnownEntry, b: KnownEntry) =>
        rankOf(a) - rankOf(b) ||
        (b.entry.status === "soon" ? 0 : 1) - (a.entry.status === "soon" ? 0 : 1) ||
        b.entry.popularity - a.entry.popularity
    const perGroup = (id: string) => searched.filter((item) => groupOfEntry(item.entry) === id).length
    const categories: ReadonlyArray<LibraryCategory> = [
        { id: "all", label: t("group_all"), count: searched.length },
        ...GROUP_ORDER.filter((id) => perGroup(id) > 0).map((id) => ({
            id,
            label: t(`group_${id}`),
            count: perGroup(id),
        })),
    ]
    const cards = [...searched]
        .filter((item) => group === "all" || groupOfEntry(item.entry) === group)
        .sort(byPopularity)
        .map((item) => cardOf(item, input))
    return { categories, cards }
}

/**
 * The connector library tab: the search (accents ignored) and the category chips with counts, then one grid of the connectors that
 * pass both. A tile opens the provider page of the connection when there is one, else the connector drawer through the
 * URL; a planned connector carries the "I need this" command.
 */
export const ConnectionLibrary = () => {
    const t = useTranslations("connections")
    const overlays = useConnectionOverlays()
    const { role } = useConnectionsRole()
    const workspaceId = useWorkspaceId()
    const data = useConnectionsData()
    const { items } = data
    const isLoading = "isLoading" in data.slot
    const [text, setText] = useState("")
    const group = asGroup(useSearchParams().get("group") ?? "all")
    const [wants, setWants] = useState<Readonly<Record<string, LibraryCard["want"]>>>({})
    const want = useWantConnector()
    const lifeOf = useLibraryLife()
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
        () => libraryOf({ workspaceId, t, items, text, group, wants, role, lifeOf }),
        [workspaceId, t, items, text, group, wants, role, lifeOf],
    )
    return (
        <ConnectionLibraryBase
            props={{
                text,
                searchLabel: t("libSearch"),
                clearLabel: t("libClear"),
                filterLabel: t("libFilter"),
                categories,
                emptyMessage: t("libEmpty"),
                emptyHint: t("libEmptyHint"),
                wantLabel: t("libWant"),
                wantedLabel: t("libWanted"),
                connectLabel: t("libConnect"),
                viewLabel: t("libView"),
                openPageLabel: t("openPage"),
                cards,
                isLoading,
            }}
            on={{
                text: setText,
                open: overlays.openDetail,
                want: askFor,
            }}
        />
    )
}
