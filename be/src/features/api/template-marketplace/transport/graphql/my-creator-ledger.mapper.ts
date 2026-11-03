import type { CreatorLedgerView } from "@modules/domain/template-marketplace"
import type { CreatorLedgerType } from "./dto/creator-ledger.type"
import { toCreatorLedgerType } from "./template-marketplace.records.mapper"

/** Maps the answer to the GraphQL type. */
export const toMyCreatorLedgerType = (result: CreatorLedgerView): CreatorLedgerType => toCreatorLedgerType(result)
