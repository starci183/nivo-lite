import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { ApplyToHiringJobCommand } from "../../application/apply-to-hiring-job.command"
import { ApplyResultType } from "./dto/apply-result.type"
import { ApplyToHiringJobInput } from "./dto/apply-to-hiring-job.input"
import { toApplyToHiringJobRequest, toApplyResultType } from "./hiring-public.mapper"

@Resolver()
/** GraphQL door: apply for a job. */
export class ApplyToHiringJobResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Apply for a job. */
    @Public({ reason: PublicReason.PublicForm })
    @RateLimit(RateTier.Strict)
    @Mutation(() => ApplyResultType, { name: "applyToHiringJob" })
    async applyToHiringJob(@Args("input") input: ApplyToHiringJobInput): Promise<ApplyResultType> {
        const result = await this.commandBus.execute(
            new ApplyToHiringJobCommand({ request: toApplyToHiringJobRequest(input) }),
        )
        return toApplyResultType(result)
    }
}
