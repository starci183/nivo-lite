/** Text with its accents, case and the Vietnamese d-bar folded away, for matching and for keys. */
export const fold = (text: string): string =>
    text
        .normalize("NFD")
        .replaceAll(/\p{M}/gu, "")
        .replaceAll(/\u0111/giu, "d")
        .toLowerCase()
