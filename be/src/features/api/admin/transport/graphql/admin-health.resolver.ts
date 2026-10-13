import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetPlatformHealthQuery } from "../../application/get-platform-health.query"
import { AdminHealthType } from "./dto/admin-health.type"
import { toAdminHealthRequest, toAdminHealthType } from "./admin-health.mapper"

@Resolver()
/** GraphQL door of adminHealth. */
export class AdminHealthResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers the platform health page: engine, queue, failures, sign-ups, billing events and errors. */
    @Query(() => AdminHealthType, { name: "adminHealth" })
    async adminHealth(@CurrentPrincipal() principal: Principal): Promise<AdminHealthType> {
        const result = await this.queryBus.execute(
            new GetPlatformHealthQuery({ request: toAdminHealthRequest(), principal }),
        )
        return toAdminHealthType(result)
    }
}
