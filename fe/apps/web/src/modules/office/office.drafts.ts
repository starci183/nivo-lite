import type { OfficeCardDraft } from "@/modules/types"

/** A card nobody touched: closed, with the card's own text and amount. */
export const EMPTY_OFFICE_CARD_DRAFT: OfficeCardDraft = {
    isEditing: false,
    isExpanded: false,
    text: null,
    amount: null,
    values: {},
    candidateId: null,
    basis: "",
}
