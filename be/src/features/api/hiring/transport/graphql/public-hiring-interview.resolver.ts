import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
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
    @Public({ reason: PublicReason.PublicForm })
    @RateLimit(RateTier.Strict)
    @Query(() => PublicInterviewType, { name: "publicHiringInterview" })
    async publicHiringInterview(@Args("input") input: HiringTokenInput): Promise<PublicInterviewType> {
        const result = await this.queryBus.execute(
            new PublicHiringInterviewQuery({ request: toPublicHiringInterviewRequest(input) }),
        )
        return toPublicInterviewType(result)
    }
}
