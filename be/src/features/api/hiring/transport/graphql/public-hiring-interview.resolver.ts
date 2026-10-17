import type { CredentialPrincipal } from "@modules/domain/identity"
import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Credential, CurrentCredentialPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { PublicHiringInterviewQuery } from "../../application/public-hiring-interview.query"
import { PublicInterviewType } from "./dto/public-interview.type"
import { HiringTokenInput } from "./dto/hiring-token.input"
import { toPublicHiringInterviewRequest, toPublicInterviewType } from "./hiring-public.mapper"

@Resolver()
/** GraphQL door: read an interview from the candidate's link. */
export class PublicHiringInterviewResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Read an interview from the candidate's link. */
    @Credential({ kind: "link-token", workflow: "public-hiring-interview" })
    @RateLimit(RateTier.Strict)
    @Query(() => PublicInterviewType, { name: "publicHiringInterview" })
    async publicHiringInterview(
        @Args("input") input: HiringTokenInput,
        @CurrentCredentialPrincipal() credentialPrincipal: CredentialPrincipal,
    ): Promise<PublicInterviewType> {
        const result = await this.queryBus.execute(
            new PublicHiringInterviewQuery({
                request: { ...toPublicHiringInterviewRequest(input), credentialPrincipal },
            }),
        )
        return toPublicInterviewType(result)
    }
}
