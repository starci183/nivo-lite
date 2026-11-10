import { wordOf } from "../../messages/catalog"

/** The text lower case, without accents or doubled blanks, so a phrase matches however it is typed. */
export const plainOf = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replaceAll(/\p{M}/gu, "")
        .replaceAll(wordOf("letterD"), "d")
        .replaceAll(/\s+/gu, " ")
        .trim()
