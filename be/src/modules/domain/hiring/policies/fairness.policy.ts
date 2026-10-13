import type { FairnessCategory, FairnessViolation, JobDraftTexts } from "../hiring.contracts"
import { fold } from "./text.policy"

interface FairnessRule {
    readonly category: FairnessCategory
    readonly on: "lower" | "fold"
    readonly re: RegExp
}

/** Words of context kept on each side of a found phrase. */
const CONTEXT_WORDS = 2

/** Violations quoted in one refusal before the rest are only counted. */
export const QUOTED_VIOLATIONS = 4

/** Ages that are the legal minimum working age, never a screening criterion. */
const LEGAL_MINIMUM_AGES: ReadonlyArray<number> = [15, 16, 18]

/** Prefixes that make a legal minimum age ("tu 18 tuoi"). */
const MINIMUM_PREFIXES: ReadonlyArray<string> = ["tu", "du", "toi thieu", "it nhat"]

const NOT_LETTER_BEFORE = String.raw`(?<![\p{L}\p{N}])`
const NOT_LETTER_AFTER = String.raw`(?![\p{L}\p{N}])`

const word = (alternatives: string): RegExp =>
    new RegExp(`${NOT_LETTER_BEFORE}(?:${alternatives})${NOT_LETTER_AFTER}`, "gu")

const plain = (alternatives: string): RegExp => new RegExp(`(?<![a-z])(?:${alternatives})(?![a-z])`, "gu")

const FAIRNESS_RULES: ReadonlyArray<FairnessRule> = [
    {
        category: "gender",
        on: "lower",
        re: word(
            "n\u1eef(?! trang)|ph\u1ee5 n\u1eef|\u0111\u00e0n \u00f4ng|con g\u00e1i|con trai|ph\u00e1i n\u1eef|ph\u00e1i nam|n\u1eef gi\u1edbi|nam gi\u1edbi|gi\u1edbi t\u00ednh|female|male",
        ),
    },
    {
        category: "gender",
        on: "lower",
        re: word(
            String.raw`(?:nh\u1eadn|\u01b0u ti\u00ean|y\u00eau c\u1ea7u|ch\u1ec9|c\u1ea7n|tuy\u1ec3n|l\u00e0|\u1ee9ng vi\u00ean|b\u1ea1n)\s+nam`,
        ),
    },
    {
        category: "gender",
        on: "lower",
        re: new RegExp(
            String.raw`${NOT_LETTER_BEFORE}nam\s*(?:/|,|-|ho\u1eb7c|v\u00e0)\s*n\u1eef|${NOT_LETTER_BEFORE}nam\s+(?:t\u1eeb|d\u01b0\u1edbi|tr\u00ean|cao|\d|tu\u1ed5i|\u0111\u1ed9c th\u00e2n|sinh|kh\u1ecfe|m\u1ea1nh)`,
            "gu",
        ),
    },
    {
        category: "gender",
        on: "fold",
        re: new RegExp(
            "(?<![a-z0-9])(?:nu(?! trang)|gioi tinh|nam gioi|nu gioi|phu nu|dan ong|con gai|con trai)(?![a-z0-9])",
            "gu",
        ),
    },
    { category: "age", on: "fold", re: /(\d{2})\s*(?:-|~|den|toi)\s*(\d{2})\s*tuoi/gu },
    {
        category: "age",
        on: "fold",
        re: /(?:(duoi|tren|tu|du|khong qua|khong vuot qua|toi da|toi thieu|it nhat|under|over)\s*)?(\d{2})\s*tuoi/gu,
    },
    {
        category: "age",
        on: "fold",
        re: /(?<![a-z])(?:do tuoi|tuoi tu|tuoi duoi|tuoi tren|bao nhieu tuoi|may tuoi|tuoi cua ban|nam sinh|sinh nam\s*\d{4}|(?:19|20)\d{2}\s*tro (?:ve sau|lai))/gu,
    },
    { category: "age", on: "fold", re: plain("tre trung|tre khoe|con tre|lon tuoi|trung nien|tuoi tre|qua tuoi") },
    {
        category: "religion",
        on: "fold",
        re: plain(
            "ton giao|cong giao|thien chua|phat giao|dao phat|tin lanh|hoi giao|khong theo dao|theo dao|phat tu|co doc giao|ki to giao",
        ),
    },
    { category: "ethnicity", on: "fold", re: plain("dan toc|nguoi kinh|nguoi hoa|chung toc|mau da") },
    {
        category: "marital",
        on: "fold",
        re: plain(
            "doc than|da ket hon|chua ket hon|ket hon|chua co gia dinh|da co gia dinh|lap gia dinh|tinh trang hon nhan|hon nhan|co con nho|chua co con|da co con|so con|ly hon|ly di|chua co chong|chua co vo",
        ),
    },
    {
        category: "pregnancy",
        on: "fold",
        re: plain(
            "mang thai|co thai|co bau|mang bau|dang bau|ke hoach sinh con|du dinh sinh con|dinh sinh con|sinh con",
        ),
    },
    {
        category: "disability",
        on: "fold",
        re: plain("khuyet tat|tan tat|di tat|di dang|benh man tinh|tien su benh|hiv"),
    },
    {
        category: "hometown",
        on: "fold",
        re: plain(
            "que quan|noi sinh|ho khau|nguoi goc|nguoi dia phuong|nguoi mien (?:bac|trung|nam)|nguoi (?:ha noi|sai gon|hue|da nang)",
        ),
    },
    {
        category: "appearance",
        on: "fold",
        re: plain(
            String.raw`ngoai hinh|ua nhin|xinh dep|xinh xan|dep trai|chieu cao|can nang|cao 1m\d{0,2}|cao \d{3} ?cm`,
        ),
    },
]

interface FoldedText {
    readonly folded: string
    readonly map: ReadonlyArray<number>
}

/** The folded text with a map from each folded character back to the position in the original, so excerpts quote the writer's own words. */
const foldMapped = (text: string): FoldedText => {
    let folded = ""
    const map: Array<number> = []
    let offset = 0
    for (const character of text) {
        const part = fold(character)
        folded += part
        map.push(...Array.from(part, () => offset))
        offset += character.length
    }
    map.push(offset)
    return { folded, map }
}

const isSpace = (character: string | undefined): boolean => character !== undefined && /\s/u.test(character)

/** Moves `from` back over `count` whole words (and the spaces between them). */
const wordsBefore = (text: string, from: number, count: number): number =>
    Array.from({ length: count }).reduce<number>((position) => {
        let at = position
        while (at > 0 && isSpace(text[at - 1])) at -= 1
        while (at > 0 && !isSpace(text[at - 1])) at -= 1
        return at
    }, from)

/** Moves `from` forward over `count` whole words (and the spaces between them). */
const wordsAfter = (text: string, from: number, count: number): number =>
    Array.from({ length: count }).reduce<number>((position) => {
        let at = position
        while (at < text.length && isSpace(text[at])) at += 1
        while (at < text.length && !isSpace(text[at])) at += 1
        return at
    }, from)

/** True for "tu 18 tuoi", "du 16 tuoi" and "18 tuoi tro len": the legal minimum working age. */
const isLegalMinimumAge = (prefix: string | undefined, age: number, after: string): boolean =>
    LEGAL_MINIMUM_AGES.includes(age) &&
    ((prefix !== undefined && MINIMUM_PREFIXES.includes(prefix)) || /^\s*tro len/u.test(after))

/** Every place a text asks for, or screens on, a protected trait; empty means fine. `field` names where it was found. */
export const findFairnessViolations = (text: string, field = ""): Array<FairnessViolation> => {
    const normalized = text.normalize("NFC")
    const lower = normalized.toLowerCase()
    const { folded, map } = foldMapped(normalized)
    const hasMarks = lower !== folded
    const found = new Map<string, FairnessViolation>()
    FAIRNESS_RULES.filter((rule) => hasMarks || rule.on !== "lower" || rule.category !== "gender").forEach((rule) => {
        const hay = rule.on === "fold" ? folded : lower
        for (const match of hay.matchAll(rule.re)) {
            const start = match.index
            const prefix = rule.category === "age" ? match[1] : undefined
            const ageText = rule.category === "age" ? match[2] : undefined
            const after = hay.slice(start + match[0].length, start + match[0].length + 12)
            const legal =
                ageText !== undefined &&
                /^\d{2}$/u.test(ageText) &&
                !/^\d/u.test(prefix ?? "") &&
                isLegalMinimumAge(prefix, Number(ageText), after)
            const from = rule.on === "fold" ? (map[start] ?? start) : start
            const to =
                rule.on === "fold"
                    ? (map[Math.min(start + match[0].length, map.length - 1)] ?? 0)
                    : start + match[0].length
            const key = `${rule.category}:${from}`
            if (!legal && !found.has(key)) {
                const excerpt = normalized
                    .slice(wordsBefore(normalized, from, CONTEXT_WORDS), wordsAfter(normalized, to, CONTEXT_WORDS))
                    .replace(/\s+/gu, " ")
                    .trim()
                found.set(key, { category: rule.category, excerpt, field })
            }
        }
    })
    return [...found.values()]
}

/** Runs the validator over every text a job puts in front of candidates or uses to screen them. */
export const validateJobDraft = (draft: JobDraftTexts): Array<FairnessViolation> => {
    const fields: Array<[string, string | undefined]> = [
        ["title", draft.title],
        ["position", draft.position],
        ["description", draft.description],
        ["schedule", draft.schedule],
        ["experience", draft.requirements.experienceNote],
        ...draft.requirements.skills.map((entry): [string, string] => ["skill", entry]),
        ...draft.requirements.availability.map((entry): [string, string] => ["availability", entry]),
        ...draft.requirements.mustHave.map((entry): [string, string] => ["mustHave", entry]),
        ...draft.requirements.niceToHave.map((entry): [string, string] => ["niceToHave", entry]),
        ...draft.questions.flatMap((question): Array<[string, string]> => [
            ["question", question.text],
            ...(question.choices ?? []).map((choice): [string, string] => ["choice", choice]),
        ]),
    ]
    return fields.flatMap(([field, text]) =>
        text !== undefined && text.trim() !== "" ? findFairnessViolations(text, field) : [],
    )
}

/** Candidate text for the screening model with every sentence that touches a protected trait removed; a candidate may volunteer them and they are never read. */
export const scrubProtected = (text: string): string =>
    text
        .split(/(?<=[.!?\n;])\s+/u)
        .filter((sentence) => findFairnessViolations(sentence).length === 0)
        .join(" ")
        .trim()

/** Drops every line that touches a protected trait; what is left is safe to show, and a model is never the last check. */
export const stripUnfairLines = (text: string): string =>
    text
        .split("\n")
        .filter((line) => findFairnessViolations(line).length === 0)
        .join("\n")
        .trim()
