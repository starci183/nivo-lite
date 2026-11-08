import type { useFormatter, useTranslations } from "next-intl"
import type {
    DataSlot,
    DocChipView,
    DocListTabView,
    DocRowView,
    PublicBrainCopy,
    PublicDraftView,
} from "@/modules/types"
import { failureKeyOf, listedPublicDocs, publicBadgeOf } from "./public-docs"
import type { PublicBadge, PublicDocument } from "./public-docs"

/** The translators the public documents screen speaks through. */
type PublicTranslate = ReturnType<typeof useTranslations<"publicBrain">>
type PublicPaneTranslate = ReturnType<typeof useTranslations<"brainPublic">>
type PublicFormat = ReturnType<typeof useFormatter>

/** The filters of the public documents list, in the order they are drawn: every document, then one per state. */
const PUBLIC_TABS = ["all", "published", "pending", "review", "drafting", "failed"] as const

/** One filter of the public documents list. */
type PublicTabId = (typeof PUBLIC_TABS)[number]

/** The filter an address value names; anything else is every document. */
export const publicTabOf = (value: string): PublicTabId => PUBLIC_TABS.find((tab) => tab === value) ?? "all"

const BADGE_TONE: Readonly<Record<PublicBadge, DocChipView["tone"]>> = {
    drafting: "neutral",
    failed: "danger",
    review: "warning",
    published: "success",
    pending: "warning",
}

/** The documents a tab shows, narrowed by the search text over the title. */
export const publicDocsMatching = (
    docs: ReadonlyArray<PublicDocument>,
    tab: PublicTabId,
    query: string,
): ReadonlyArray<PublicDocument> => {
    const needle = query.trim().toLowerCase()
    return listedPublicDocs(docs).filter(
        (doc) =>
            (tab === "all" || publicBadgeOf(doc) === tab) &&
            (needle === "" || doc.title.toLowerCase().includes(needle)),
    )
}

/** How many of the listed documents a tab holds. */
const countOf = (listed: ReadonlyArray<PublicDocument>, tab: PublicTabId): number =>
    tab === "all" ? listed.length : listed.filter((doc) => publicBadgeOf(doc) === tab).length

/** The tabs with how many documents each holds; a tab for a state nobody is in has no count and stays out unless chosen. */
export const publicTabsOf = (
    docs: ReadonlyArray<PublicDocument> | undefined,
    chosen: PublicTabId,
    t: PublicPaneTranslate,
): ReadonlyArray<DocListTabView> => {
    const listed = docs === undefined ? undefined : listedPublicDocs(docs)
    return PUBLIC_TABS.filter(
        (tab) =>
            tab === "all" || tab === chosen || listed === undefined || listed.some((doc) => publicBadgeOf(doc) === tab),
    ).map((tab) => ({
        id: tab,
        label: t(`tab_${tab}`),
        count: listed === undefined ? undefined : countOf(listed, tab),
    }))
}

/** Who approved a document and when, or that nobody did yet. */
const approvalOf = (doc: PublicDocument, t: PublicTranslate, format: PublicFormat): string =>
    doc.approvedByName === null || doc.approvedAt === null
        ? t("notApproved")
        : t("approvedBy", {
              name: doc.approvedByName,
              when: format.dateTime(new Date(doc.approvedAt), { dateStyle: "medium" }),
          })

/** One row of the list: the mark, the title, who approved it (or what it was drafted from) and where it stands. */
export const publicRowOf = (doc: PublicDocument, t: PublicTranslate, format: PublicFormat): DocRowView => {
    const badge = publicBadgeOf(doc)
    return {
        id: doc.id,
        title: doc.title,
        line: doc.approvedByName === null ? t("fromSources", { n: doc.sources.length }) : approvalOf(doc, t, format),
        glyph: "public",
        chip: { label: t(`badge_${badge}`), tone: BADGE_TONE[badge] },
    }
}

/** Why a document waits for the owner: being drafted, failed, changed upstream, or simply asking to be approved. */
const noteOf = (
    doc: PublicDocument,
    badge: PublicBadge,
    t: PublicTranslate,
    p: PublicPaneTranslate,
): PublicDraftView["note"] => {
    if (badge === "drafting") return { tone: "informative", title: t("alertDrafting"), description: null }
    if (badge === "failed") return { tone: "negative", title: t(failureKeyOf(doc.failureCode)), description: null }
    if (badge === "review") return { tone: "cautionary", title: t("alertReview"), description: null }
    return badge === "pending" ? { tone: "informative", title: p("noteTitle"), description: p("noteBody") } : null
}

/** The open document: its head, what it waits for, where it came from, who approved it and the commands it still offers. */
export const publicDraftOf = (
    doc: PublicDocument,
    t: PublicTranslate,
    p: PublicPaneTranslate,
    format: PublicFormat,
): PublicDraftView => {
    const badge = publicBadgeOf(doc)
    const approveKey = doc.needsReview ? "approveAgain" : "approveAndPublish"
    return {
        id: doc.id,
        title: doc.title,
        meta: t("fromSources", { n: doc.sources.length }),
        badge: { label: t(`badge_${badge}`), tone: BADGE_TONE[badge] },
        note: noteOf(doc, badge, t, p),
        canEdit: badge !== "drafting",
        sources: doc.sources.map((source) => ({
            id: source.sourceId,
            label: source.changed ? `${source.title} · ${t("sourceChanged")}` : source.title,
        })),
        leftOut:
            doc.leftOut.length === 0
                ? null
                : t("leftOutLine", {
                      items: doc.leftOut
                          .map((item) => (item.reason === "" ? item.label : `${item.label} · ${item.reason}`))
                          .join(", "),
                  }),
        approval: doc.approvedByName === null || doc.approvedAt === null ? null : approvalOf(doc, t, format),
        publishedBody: doc.publishedBody,
        redraftLabel: doc.needsReview || badge === "failed" ? t("redraft") : null,
        approveLabel: badge === "drafting" || badge === "failed" ? null : t(approveKey),
    }
}

type PaneTranslate = ReturnType<typeof useTranslations<"pane">>

/** The words of the public documents screen that belong to no data. */
export const publicCopyOf = (t: PublicTranslate, p: PublicPaneTranslate, tp: PaneTranslate): PublicBrainCopy => ({
    grid: p("gridLabel"),
    listLabel: t("listTitle"),
    listTitle: t("listTitle"),
    searchLabel: p("searchLabel"),
    searchPlaceholder: p("searchLabel"),
    clearSearch: tp("clearSearch"),
    tabsLabel: p("tabsLabel"),
    moreFilters: (count) => tp("moreFilters", { count }),
    moreWord: tp("moreWord"),
    back: tp("backToList"),
    moreActions: tp("moreActions"),
    closeAside: tp("closeAside"),
    pickTitle: p("pickTitle"),
    pickBody: p("pickBody"),
    noMatchTitle: tp("noMatchTitle"),
    noMatchBody: tp("noMatchBody"),
    clearFilters: tp("clearFilters"),
    emptyBody: t("listEmpty"),
    emptyAction: p("composeLabel"),
    errorBody: tp("errorBody"),
    noteTitle: p("noteTitle"),
    noteBody: p("noteBody"),
    titleLabel: t("draftTitleLabel"),
    bodyLabel: t("draftBodyLabel"),
    sourcesLabel: t("draftSourcesLabel"),
    publishedLabel: t("publishedSnapshot"),
    saveLabel: t("save"),
    laterLabel: t("later"),
    archiveLabel: t("archive"),
    archiveTitle: (title) => t("archiveQuestion", { title }),
    archiveBody: t("archiveConsequence"),
    cancelLabel: t("cancel"),
    composeLabel: p("composeLabel"),
    errorTitle: t("loadFailed"),
    asideTitle: p("asksTitle"),
    asideCount: (count) => p("asksCount", { count }),
    asideEmpty: p("asksEmpty"),
    asideError: tp("errorBody"),
    asideHint: t("asksFooter"),
    answerLabel: p("asksAnswer"),
    skipLabel: t("skip"),
})

/** A document of the same shape as a ready one: while the read waits, the loading tree is the ready tree. */
export const PUBLIC_DRAFT_PLACEHOLDER: PublicDraftView = {
    id: "placeholder",
    title: "-",
    meta: "-",
    badge: { label: "-", tone: "neutral" },
    note: null,
    canEdit: false,
    sources: [{ id: "source", label: "-" }],
    leftOut: null,
    approval: null,
    publishedBody: null,
    redraftLabel: "-",
    approveLabel: "-",
}

/** The open document of the middle pane, once its read settled to data or while it is being read; null for every other state. */
export const publicOpenedOf = (
    slot: DataSlot<ReadonlyArray<PublicDraftView>>,
): { readonly draft: PublicDraftView; readonly isLoading: boolean } | null => {
    if ("items" in slot) {
        const draft = slot.items[0]
        return draft === undefined ? null : { draft, isLoading: false }
    }
    return "isLoading" in slot ? { draft: PUBLIC_DRAFT_PLACEHOLDER, isLoading: true } : null
}
