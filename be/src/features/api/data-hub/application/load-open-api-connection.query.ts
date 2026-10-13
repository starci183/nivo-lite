import { Query } from "@nestjs/cqrs"
import type { OpenApiConnectionView } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadOpenApiConnectionRequest } from "./load-open-api-connection.contracts"

/** Reads a saved API connection for the wizard, without any secret. */
export class LoadOpenApiConnectionQuery extends Query<OpenApiConnectionView> {
    constructor(readonly params: ExecuteParams<LoadOpenApiConnectionRequest>) {
        super()
    }
}
