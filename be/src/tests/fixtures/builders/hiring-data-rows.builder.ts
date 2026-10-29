import { candidateRow, interviewRow } from "./hiring-rows.builder"

/** One candidate row per id, the defaults of the area for the rest. */
export const candidateRowsOf = (ids: ReadonlyArray<string>) => ids.map((id) => candidateRow({ id }))

/** A proposed interview that has no slot yet and no proposed slots. */
export const unslottedInterviewRow = () =>
    interviewRow({ status: "proposed", slotStart: null, slotEnd: null, proposedSlots: null })
