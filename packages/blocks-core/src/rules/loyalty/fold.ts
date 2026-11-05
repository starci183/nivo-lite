/** Text with its accents, case and the Vietnamese d-bar folded away, for matching and for keys. */
export const fold = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\u0111/giu, "d")
        .toLowerCase()
