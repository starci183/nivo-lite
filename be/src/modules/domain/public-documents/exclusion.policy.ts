import { EXCLUSION_REASONS, type ExclusionReason, type LeftOut } from "./public-documents.contracts"

/** The longest label of a piece that was left out. */
const LABEL_CHARS = 60

const D_STROKE = String.fromCodePoint(0x111)

/** The words that mark each kind, written without accents and in lower case (see `foldedOf`). */
const MARKERS: Readonly<Record<ExclusionReason, RegExp>> = {
    salary: /\b(?<!so |trong |khoi |dung )(luong|salary|salaries|payroll)\b|\bbang luong\b|\bthuong tet\b|\bphu cap\b/u,
    id_number:
        /\b(cccd|cmnd|can cuoc|chung minh nhan dan|passport|ho chieu|ma so thue ca nhan)\b|\b\d{12}\b|\b\d{9}\b/u,
    contract: /\b(hop dong|contract|nda|phu luc)\b/u,
    capital:
        /\b(von dieu le|von gop|von chu so huu|von dau tu|von vay|von luu dong|gia von|charter capital|cost price)\b|\bvon\b/u,
    internal_discount:
        /\b(gia dai ly|gia si|gia noi bo|gia nhan vien|internal discount)\b|\bchiet khau\b.*\b(dai ly|noi bo|nhan vien|doi tac|si)\b|\b(dai ly|noi bo|nhan vien|doi tac)\b.*\bchiet khau\b/u,
}

/** A text in lower case without accents, so one pattern covers how people type Vietnamese. */
export const foldedOf = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(D_STROKE, "d")

/** The kinds of never-public content a text holds, in the fixed order of the reasons. */
export const exclusionsOf = (text: string): ReadonlyArray<ExclusionReason> => {
    const folded = foldedOf(text)
    return EXCLUSION_REASONS.filter((reason) => MARKERS[reason].test(folded))
}

/** A short label of a piece: its first words with long digit runs masked, so a left-out number is not kept whole. */
const labelOf = (line: string): string => {
    const masked = line.trim().replaceAll(/\d{4,}/gu, "…")
    return masked.length > LABEL_CHARS ? `${masked.slice(0, LABEL_CHARS - 1).trimEnd()}…` : masked
}

/** A text split into what may go on and what was left out. */
export interface ExclusionSplit {
    /** The lines that hold none of the hard exclusions, in order. */
    readonly kept: string
    /** The lines that were left out, each with its first reason. */
    readonly leftOut: ReadonlyArray<LeftOut>
}

/**
 * Removes every line that holds salary, an identity number, a contract, capital or an internal discount. The test runs per line, so
 * one sensitive line in a list leaves the rest of the list. Nothing here asks a model: these are never proposed to the public.
 */
export const withoutExcluded = (text: string): ExclusionSplit => {
    const lines = text.split(/\r?\n/u)
    const leftOut: Array<LeftOut> = []
    const kept: Array<string> = []
    for (const line of lines) {
        const [reason] = exclusionsOf(line)
        if (reason === undefined) {
            kept.push(line)
            continue
        }
        if (line.trim() !== "") leftOut.push({ label: labelOf(line), reason })
    }
    return {
        kept: kept
            .join("\n")
            .replaceAll(/\n{3,}/gu, "\n\n")
            .trim(),
        leftOut,
    }
}
