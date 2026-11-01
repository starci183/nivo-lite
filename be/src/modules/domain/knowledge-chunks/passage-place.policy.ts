import type { MaybePassagePlace, MaybePlaceText, PassagePlaceKind } from "./knowledge-chunks.contracts"

const KINDS: ReadonlyArray<PassagePlaceKind> = ["page", "slide", "sheet"]

/** The place a stored passage names, or null for a passage stored before places (either column empty, or a kind nobody knows). */
export const placeOfRow = (kind: MaybePlaceText, label: MaybePlaceText): MaybePassagePlace => {
    const known = KINDS.find((one) => one === kind)
    return known === undefined || label === null ? null : { kind: known, label }
}
