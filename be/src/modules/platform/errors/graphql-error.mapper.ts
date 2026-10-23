import { GraphQLError } from "graphql"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorDescription, FailureSite } from "./errors.contracts"
import type { ErrorsService } from "./errors.service"

const describeGraphqlFailure = (errors: ErrorsService, error: unknown, site: FailureSite): ErrorDescription => {
    if (error instanceof GraphQLError) {
        return error.originalError ? errors.describe(error.originalError, site) : errors.describeInvalidOperation()
    }
    return errors.describe(error, site)
}

/**
 * The one GraphQL error formatter: a failure thrown by a resolver becomes `errors[].extensions.{code,kind,params}`;
 * a malformed operation (no original error) is `invalid`; anything else is masked. The message is the code until the
 * response plugin localizes it.
 */
export const formatGraphqlError = (
    errors: ErrorsService,
    formatted: GraphQLFormattedError,
    error: unknown,
): GraphQLFormattedError => {
    const operation = formatted.path?.map(String).join(".")
    const site: FailureSite = { scope: "graphql", context: operation === undefined ? {} : { operation } }
    const description = describeGraphqlFailure(errors, error, site)
    return {
        ...formatted,
        message: description.code,
        extensions: { code: description.code, kind: description.kind, params: description.params },
    }
}
