/**
 * The guide search reads every text the same way, so a query and an index entry meet on equal terms:
 * lower case, accents removed (the Vietnamese d with stroke is a plain d), every run of anything but a letter, a digit, an at sign or
 * a dot is one space. "Cap ket noi" and "cap ket noi" and "CAP-KET-NOI" are the same text.
 */
export const normalize = (value: string): string =>
    value
        .toLowerCase()
        .replaceAll(String.fromCodePoint(0x111), "d")
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(/[^a-z0-9@.]+/gu, " ")
        .trim()

/** The words of a text after {@link normalize}. */
export const wordsOf = (value: string): ReadonlyArray<string> => {
    const text = normalize(value)
    return text === "" ? [] : text.split(" ")
}
