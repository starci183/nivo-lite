import type { RecordTemplateLikenessRequest } from "../../application/record-template-likeness.contracts"
import type { LikenessGrantView } from "@modules/domain/template-marketplace"
import type { RecordTemplateLikenessInput } from "./dto/record-template-likeness.input"
import type { LikenessGrantType } from "./dto/likeness-grant.type"
import { toLikenessGrantType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of recordTemplateLikeness to the request. */
export const toRecordTemplateLikenessRequest = (input: RecordTemplateLikenessInput): RecordTemplateLikenessRequest => ({
    templateKey: input.templateKey,
    personName: input.personName,
    allowedUses: input.allowedUses,
    disclosure: input.disclosure,
    expiresAt: input.expiresAt,
})

/** Maps the answer to the GraphQL type. */
export const toRecordTemplateLikenessType = (result: LikenessGrantView): LikenessGrantType =>
    toLikenessGrantType(result)
