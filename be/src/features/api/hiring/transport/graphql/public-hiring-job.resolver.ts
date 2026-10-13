import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { PublicHiringJobQuery } from "../../application/public-hiring-job.query"
import { PublicJobType } from "./dto/public-job.type"
import { PublicHiringJobInput } from "./dto/public-hiring-job.input"
import { toPublicHiringJobRequest, toPublicJobType } from "./hiring-public.mapper"

@Resolver()
/** GraphQL door: read a published job for the apply page. */
export class PublicHiringJobResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Read a published job for the apply page. */
    @Public({ reason: PublicReason.CatalogRead })
    @RateLimit(RateTier.Strict)
    @Query(() => PublicJobType, { name: "publicHiringJob" })
    async publicHiringJob(@Args("input") input: PublicHiringJobInput): Promise<PublicJobType> {
        const result = await this.queryBus.execute(
            new PublicHiringJobQuery({ request: toPublicHiringJobRequest(input) }),
        )
        return toPublicJobType(result)
    }
}
