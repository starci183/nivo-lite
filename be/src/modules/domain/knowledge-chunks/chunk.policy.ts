/** About 800 characters per passage. */
export const CHUNK_SIZE = 800

/** The tail of the previous passage that starts the next prose passage. */
export const CHUNK_OVERLAP = 120

const D_STROKE = String.fromCodePoint(0x111)

/** The most common count of a delimiter per line and how many lines carry it. */
interface Mode {
    /** The count. */
    readonly mode: number
    /** How many lines carry it. */
    readonly best: number
}

/** One piece of a source on its way to a passage: a table piece keeps its own boundaries and takes no overlap. */
interface Piece {
    /** The text of the piece. */
    readonly text: string
    /** True when the piece is a run of table rows with its header. */
    readonly table: boolean
}

/**
 * Same text, tidy: NFC, one newline style, no control or zero-width characters, spaces collapsed, runs of dots and dashes shortened,
 * at most one blank line in a row.
 */
export const normalizeText = (text: string): string =>
    text
        .normalize("NFC")
        .replace(/\r\n?|\u2028|\u2029/gu, "\n")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, "")
        .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/gu, "")
        .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/gu, " ")
        .replace(/([.\-_=*~\u00b7\u2022])\1{4,}/gu, "$1$1$1")
        .replace(/[ \t]+/gu, " ")
        .replace(/ ?\n ?/gu, "\n")
        .replace(/\n{3,}/gu, "\n\n")
        .trim()

/** What makes two pieces "the same" for de-duplication: case, accents and punctuation ignored. */
const sameKey = (text: string): string =>
    text
        .toLowerCase()
        .replaceAll(D_STROKE, "d")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/gu, " ")
        .trim()

/** Never cut between the two halves of a surrogate pair. */
const safeCut = (text: string, at: number): number => (/[\ud800-\udbff]$/u.test(text.slice(0, at)) ? at - 1 : at)

/** The best place to cut a window: after a sentence end or a line break, else at a space, else anywhere. */
const cutOf = (text: string, window: string, max: number): number => {
    const sentence = Math.max(
        window.lastIndexOf(". "),
        window.lastIndexOf("\n"),
        window.lastIndexOf("; "),
        window.lastIndexOf("! "),
        window.lastIndexOf("? "),
    )
    if (sentence >= max * 0.4) return sentence + 1
    const space = window.lastIndexOf(" ")
    return space >= max * 0.4 ? space + 1 : safeCut(text, max)
}

/** Split an over-long block at sentence ends, then at spaces, then anywhere, so no piece is longer than `max`. */
const splitLong = (block: string, max: number): Array<string> => {
    if (block.length <= max) return [block]
    const out: Array<string> = []
    let rest = block
    while (rest.length > max) {
        const cut = cutOf(rest, rest.slice(0, max), max)
        out.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
    }
    out.push(rest)
    return out
}

/** The count that most lines of a block carry of one delimiter (the larger count wins a tie). */
const modeOf = (counts: ReadonlyArray<number>): Mode => {
    const frequency = new Map<number, number>()
    for (const count of counts) frequency.set(count, (frequency.get(count) ?? 0) + 1)
    let mode = 0
    let best = 0
    for (const [count, times] of frequency) {
        if (times > best || (times === best && count > mode)) {
            mode = count
            best = times
        }
    }
    return { mode, best }
}

/** The delimiter of a block that looks like a table or CSV (most lines carry the same number of it), or null. */
const delimiterOf = (lines: ReadonlyArray<string>): string | null => {
    if (lines.length < 3) return null
    for (const delimiter of ["\t", "|", ";", ","]) {
        const { mode, best } = modeOf(lines.map((line) => line.split(delimiter).length - 1))
        if (mode >= (delimiter === "," ? 2 : 1) && best / lines.length >= 0.7) return delimiter
    }
    return null
}

/** A table by rows: each piece is the header plus as many rows as fit. Duplicate rows are dropped. */
const tablePieces = (lines: ReadonlyArray<string>, size: number): Array<Piece> => {
    const rows = lines.filter((line) => line.trim() !== "" && !/^[\s|:+-]+$/u.test(line))
    const first = rows[0]
    if (first === undefined) return []
    const header = first.length <= size / 2 ? first : ""
    const body = header === "" ? rows : rows.slice(1)
    const room = Math.max(120, size - header.length - 1)
    const out: Array<Piece> = []
    const seen = new Set<string>()
    let current: Array<string> = []
    let length = 0
    const flush = (): void => {
        if (current.length > 0) {
            out.push({ text: (header === "" ? current : [header, ...current]).join("\n"), table: true })
        }
        current = []
        length = 0
    }
    for (const row of body) {
        const key = sameKey(row)
        if (key !== "" && seen.has(key)) continue
        seen.add(key)
        for (const part of splitLong(row, room)) {
            if (length > 0 && length + 1 + part.length > room) flush()
            current.push(part)
            length += part.length + 1
        }
    }
    flush()
    return out.length > 0 ? out : [{ text: header, table: true }]
}

/** The prose pieces of a body and its tables, in order; a repeated long paragraph is kept once. */
const piecesOf = (body: string, size: number): Array<Piece> => {
    const seenBlocks = new Set<string>()
    const pieces: Array<Piece> = []
    for (const block of body.split(/\n{2,}/u)) {
        const lines = block.split("\n")
        if (delimiterOf(lines) !== null) {
            pieces.push(...tablePieces(lines, size))
            continue
        }
        // Boilerplate (a footer repeated on every page) is long enough to recognise; short repeats are kept.
        const key = sameKey(block)
        if (block.length >= 30 && key !== "") {
            if (seenBlocks.has(key)) continue
            seenBlocks.add(key)
        }
        for (const part of splitLong(block, size)) pieces.push({ text: part, table: false })
    }
    return pieces
}

/** Prose pieces packed into passages of up to `size` characters; every table piece stands alone. */
const packed = (pieces: ReadonlyArray<Piece>, size: number): Array<Piece> => {
    const out: Array<Piece> = []
    let current = ""
    const flush = (): void => {
        if (current !== "") out.push({ text: current, table: false })
        current = ""
    }
    for (const piece of pieces) {
        if (piece.table) {
            flush()
            out.push(piece)
        } else if (current !== "" && current.length + 2 + piece.text.length > size) {
            flush()
            current = piece.text
        } else {
            current = current === "" ? piece.text : `${current}\n\n${piece.text}`
        }
    }
    flush()
    return out
}

/** The passage with the tail of the previous prose passage in front, cut at a word boundary; a table or the first passage has none. */
const overlapped = (piece: Piece, previous: Piece | undefined, overlap: number): string => {
    if (previous === undefined || piece.table || previous.table) return piece.text
    let tail = previous.text.slice(-overlap)
    const space = tail.indexOf(" ")
    if (space > 0 && space < tail.length - 10) tail = tail.slice(space + 1)
    return `${tail.trim()}\n${piece.text}`
}

/**
 * Paragraphs (blank-line separated; a FAQ pair stays together) are packed into passages of up to `size` characters.
 * Each prose passage after the first starts with the tail of the previous one (`overlap` characters, from a word boundary).
 * Tables and CSV are cut by row, each passage carrying the header. Identical passages and repeated long paragraphs are kept once.
 */
export const chunkText = (text: string, size: number = CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): Array<string> => {
    const body = normalizeText(text)
    if (body === "") return []
    const seen = new Set<string>()
    const unique = packed(piecesOf(body, size), size).filter((piece) => {
        const key = sameKey(piece.text) || piece.text
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
    if (overlap <= 0) return unique.map((piece) => piece.text)
    return unique.map((piece, index) => overlapped(piece, unique[index - 1], overlap))
}
