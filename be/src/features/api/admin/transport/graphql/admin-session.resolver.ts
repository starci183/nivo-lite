import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetAdminSessionQuery } from "../../application/get-admin-session.query"
import { AdminSessionType } from "./dto/admin-session.type"
import { toAdminSessionRequest, toAdminSessionType } from "./admin-session.mapper"

@Resolver()
/** GraphQL door of adminSession. */
export class AdminSessionResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Answers who the signed-in platform admin is; anyone else gets a not-found. */
    @Query(() => AdminSessionType, { name: "adminSession" })
    async adminSession(@CurrentPrincipal() principal: Principal): Promise<AdminSessionType> {
        const result = await this.queryBus.execute(
            new GetAdminSessionQuery({ request: toAdminSessionRequest(), principal }),
        )
        return toAdminSessionType(result)
    }
}
