import { GraphQLError } from "graphql"
import type { GraphQLFormattedError } from "graphql"
import type { ErrorDescription, FailureSite } from "./errors.contracts"
import type { ErrorsService } from "./errors.service"

/**
 * The error a GraphQL error stands for: its original error, followed through the wrappers the server adds (Apollo wraps a validation
 * failure of graphql-js in a GraphQLError of its own), so a malformed operation stays a GraphQLError with no original error.
 */
const innermostOf = (error: unknown): unknown =>
    error instanceof GraphQLError && error.originalError !== undefined ? innermostOf(error.originalError) : error

const describeGraphqlFailure = (errors: ErrorsService, error: unknown, site: FailureSite): ErrorDescription => {
    const inner = innermostOf(error)
    return inner instanceof GraphQLError ? errors.describeInvalidOperation() : errors.describe(inner, site)
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
