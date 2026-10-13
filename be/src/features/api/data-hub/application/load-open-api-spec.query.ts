import { Query } from "@nestjs/cqrs"
import type { OpenApiSpecLoaded } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadOpenApiSpecRequest } from "./load-open-api-spec.contracts"

/** Reads the operations of an API spec from a link or pasted text. */
export class LoadOpenApiSpecQuery extends Query<OpenApiSpecLoaded> {
    constructor(readonly params: ExecuteParams<LoadOpenApiSpecRequest>) {
        super()
    }
}
