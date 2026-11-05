import { EntitySequenceEntity } from "./entity-sequence.entity"
import { RecordLinkEntity } from "./record-link.entity"
import { RecordEntity } from "./record.entity"

export { EntitySequenceEntity, RecordEntity, RecordLinkEntity }

/** The tables of the entity engine: the records, their links and the sequence counters. */
export const entityEngineEntities: readonly [
    typeof RecordEntity,
    typeof RecordLinkEntity,
    typeof EntitySequenceEntity,
] = [RecordEntity, RecordLinkEntity, EntitySequenceEntity] as const
