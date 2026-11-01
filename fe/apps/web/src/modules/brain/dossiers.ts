/** Where a dossier stands, in the order the status counts are listed. */
export const DOSSIER_STATUS_ORDER = ["present", "partial", "drafted", "missing", "template"] as const

/** One of the statuses a dossier can have. */
export type DossierStatus = (typeof DOSSIER_STATUS_ORDER)[number]

/** The tone each status wears: held in full is success, partly held a warning, a draft the accent, missing a danger, a template neutral. */
export const DOSSIER_STATUS_TONE: Readonly<
    Record<DossierStatus, "success" | "warning" | "accent" | "danger" | "neutral">
> = {
    present: "success",
    partial: "warning",
    drafted: "accent",
    missing: "danger",
    template: "neutral",
}

/** A dossier as the back end `brainDossiers` query answers it. */
export interface DossierRecord {
    readonly id: string
    readonly ref: string
    readonly category: string
    readonly categoryOrder: number
    readonly name: string
    readonly status: string
    readonly existing?: string | null | undefined
    readonly missing?: string | null | undefined
    readonly documentCount: number
}

/** What the documents of one category hold, as the back end `knowledgeCategories` query answers it. */
export interface CategoryTotals {
    readonly topic: string
    /** The number its folder carries, when the documents say. */
    readonly order?: number | null | undefined
    readonly documentCount: number
    readonly sizeBytes: number
}

/** A dossier, worded for the list. */
export interface DossierView {
    readonly id: string
    /** The number the checklist gives it ("02"): what files a document under it and what the map prints on its node. */
    readonly ref: string
    readonly name: string
    readonly status: DossierStatus
    /** The first of: what is missing, what is already held; null when the checklist says neither. */
    readonly note: { readonly kind: "missing" | "existing"; readonly text: string } | null
    readonly documentCount: number
}

/** One category of the documents with the dossiers filed under it. */
export interface CategoryView {
    /** The topic label, which is also the key. */
    readonly id: string
    /** The number the folder carries; null for a topic no dossier names. */
    readonly order: number | null
    readonly label: string
    readonly documentCount: number
    readonly sizeBytes: number
    readonly dossiers: ReadonlyArray<DossierView>
}

const isStatus = (value: string): value is DossierStatus => Object.hasOwn(DOSSIER_STATUS_TONE, value)

/** A word without a vowel (HDTV, DKDN) is an acronym and keeps its capitals; accents are split off first, so the base letter decides. */
const hasVowel = (word: string): boolean => /[aeiouy]/iu.test(word.normalize("NFD"))

/** The standard folders of the business checklist that have a Vietnamese name, by the key of that name. */
const FOLDER_KEYS = ["legal", "hr", "finance"] as const

/** The key of a standard folder ("01 Legal files" is "legal"); null for any other name, which is shown as it is written. */
export const folderKeyOf = (topic: string): (typeof FOLDER_KEYS)[number] | null => {
    const [first = "", ...rest] = topic.trim().toLowerCase().split(" ").filter(Boolean)
    const words = Number.isNaN(Number(first)) ? [first, ...rest] : rest
    const word = words.length === 2 && words[1] === "files" ? words[0] : undefined
    return FOLDER_KEYS.find((key) => key === word) ?? null
}

/** A folder name in capitals written as a sentence: "LEGAL FILES" becomes "Legal files", and an acronym keeps its capitals. */
export const categoryLabelOf = (topic: string): string => {
    const lower = topic
        .normalize("NFC")
        .trim()
        .replace(/\p{L}+/gu, (word) => (hasVowel(word) ? word.toLocaleLowerCase("vi") : word))
    return lower.charAt(0).toLocaleUpperCase("vi") + lower.slice(1)
}

const keyOf = (topic: string): string => topic.normalize("NFC")

const noteOf = (missing: string, existing: string): DossierView["note"] => {
    if (missing !== "") return { kind: "missing", text: missing }
    return existing === "" ? null : { kind: "existing", text: existing }
}

const viewOf = (record: DossierRecord): DossierView | undefined =>
    isStatus(record.status)
        ? {
              id: record.id,
              ref: record.ref,
              name: record.name,
              status: record.status,
              note: noteOf((record.missing ?? "").trim(), (record.existing ?? "").trim()),
              documentCount: record.documentCount,
          }
        : undefined

/**
 * The categories of the workspace: every topic its documents carry and every category its dossiers name, each with what its documents
 * hold and its dossiers. Numbered categories come first in their folder order, then the others by name.
 */
export const categoriesOf = (
    totals: ReadonlyArray<CategoryTotals>,
    dossiers: ReadonlyArray<DossierRecord>,
    nameOf: (topic: string) => string | undefined = () => undefined,
): ReadonlyArray<CategoryView> => {
    const byKey = new Map<
        string,
        { label: string; order: number | null; totals?: CategoryTotals; dossiers: DossierView[] }
    >()
    for (const total of totals) {
        byKey.set(keyOf(total.topic), { label: total.topic, order: total.order ?? null, totals: total, dossiers: [] })
    }
    for (const record of dossiers) {
        const view = viewOf(record)
        if (view === undefined) continue
        const entry = byKey.get(keyOf(record.category)) ?? { label: record.category, order: null, dossiers: [] }
        entry.order ??= record.categoryOrder
        entry.dossiers.push(view)
        byKey.set(keyOf(record.category), entry)
    }
    return [...byKey.values()]
        .map((entry) => ({
            id: entry.label,
            order: entry.order,
            label: nameOf(entry.label) ?? categoryLabelOf(entry.label),
            documentCount: entry.totals?.documentCount ?? 0,
            sizeBytes: entry.totals?.sizeBytes ?? 0,
            dossiers: entry.dossiers,
        }))
        .sort((left, right) => {
            if (left.order !== null && right.order !== null) return left.order - right.order
            if (left.order !== null) return -1
            if (right.order !== null) return 1
            return left.label.localeCompare(right.label, "vi")
        })
}

/**
 * How many dossiers stand at each status, in the order the counts are listed. The status of a dossier is the checklist's own
 * unless the caller says otherwise (the review recomputes it).
 */
export const statusCountsOf = (
    categories: ReadonlyArray<CategoryView>,
    statusOf: (dossier: DossierView) => DossierStatus = (dossier) => dossier.status,
): ReadonlyArray<{ readonly status: DossierStatus; readonly count: number }> => {
    const all = categories.flatMap((category) => category.dossiers)
    return DOSSIER_STATUS_ORDER.map((status) => ({
        status,
        count: all.filter((one) => statusOf(one) === status).length,
    }))
}

/** Formats a number with at most the given digits after the point, in the language of the viewer. */
export type NumberFormatter = (value: number, maximumFractionDigits: number) => string

/** The size of a category: megabytes with one decimal, kilobytes under a tenth of a megabyte. */
export const sizeLabelOf = (bytes: number, format: NumberFormatter): string => {
    const megabytes = bytes / (1024 * 1024)
    return megabytes >= 0.1 ? `${format(megabytes, 1)} MB` : `${format(bytes / 1024, 0)} KB`
}
