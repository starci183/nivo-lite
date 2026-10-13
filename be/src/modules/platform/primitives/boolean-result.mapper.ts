import type { BooleanResultRow } from "./boolean-result.contracts"

/** Reads a boolean scalar projection, treating an empty result as false. */
export const firstBooleanResult = (rows: ReadonlyArray<BooleanResultRow>): boolean => rows[0]?.value === true
