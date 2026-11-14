import { wordOf } from "../../messages/catalog"

/** The comparable form of a name: without accents, case or extra spaces, so a name typed with accents meets the same name typed without. */
export const nameKey = (name: string): string =>
    name
        .normalize("NFD")
        .replaceAll(/\p{M}/gu, "")
        .replaceAll(wordOf("letterD"), "d")
        .replaceAll(wordOf("letterDCapital"), "D")
        .toLowerCase()
        .replaceAll(/\s+/g, " ")
        .trim()
