import type { VerifyTemplateLikenessRequest } from "../../application/verify-template-likeness.contracts"
import type { LikenessGrantView } from "@modules/domain/template-marketplace"
import type { LikenessGrantIdInput } from "./dto/likeness-grant-id.input"
import type { LikenessGrantType } from "./dto/likeness-grant.type"
import { toLikenessGrantType } from "./template-marketplace.records.mapper"

/** Maps the GraphQL arguments of verifyTemplateLikeness to the request. */
export const toVerifyTemplateLikenessRequest = (input: LikenessGrantIdInput): VerifyTemplateLikenessRequest => ({
    grantId: input.grantId,
})

/** Maps the answer to the GraphQL type. */
export const toVerifyTemplateLikenessType = (result: LikenessGrantView): LikenessGrantType =>
    toLikenessGrantType(result)
