import type { NivoEntry } from "@modules/domain/nivo-knowledge"
import type { NivoEntryType } from "./dto/nivo-entry.type"

/** Maps the answer to the GraphQL type. */
export const toNivoKnowledgeType = (result: ReadonlyArray<NivoEntry>): Array<NivoEntryType> =>
    result.map((entry) => ({ ...entry }))
