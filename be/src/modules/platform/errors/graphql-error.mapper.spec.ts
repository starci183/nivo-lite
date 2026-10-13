import { GraphQLError } from "graphql"
import type { GraphQLFormattedError } from "graphql"
import { mock } from "@starci/jest-preset"
import type { ErrorDescription } from "./errors.contracts"
import type { ErrorsService } from "./errors.service"
import { formatGraphqlError } from "./graphql-error.mapper"

const formatted: GraphQLFormattedError = {
    message: "ignored",
    locations: [{ line: 2, column: 4 }],
    path: ["calendar"],
}

const described: ErrorDescription = {
    code: "CALENDARS_NOT_FOUND",
    kind: "not-found",
    status: 404,
    params: { id: "calendar-1" },
}

describe("formatGraphqlError", () => {
    it("keeps the original error's code, kind and params, and the formatted location", () => {
        const errors = mock<ErrorsService>()
        const original = new Error("missing")
        errors.describe.mockReturnValue(described)

        expect(formatGraphqlError(errors, formatted, new GraphQLError("missing", { originalError: original }))).toEqual(
            {
                message: "CALENDARS_NOT_FOUND",
                locations: [{ line: 2, column: 4 }],
                path: ["calendar"],
                extensions: { code: "CALENDARS_NOT_FOUND", kind: "not-found", params: { id: "calendar-1" } },
            },
        )
        expect(errors.describe).toHaveBeenCalledWith(original)
    })

    it("describes a malformed operation when the GraphQL error has no original error", () => {
        const errors = mock<ErrorsService>()
        const invalid: ErrorDescription = { code: "ERRORS_OPERATION_INVALID", kind: "invalid", status: 400, params: {} }
        errors.describeInvalidOperation.mockReturnValue(invalid)

        expect(formatGraphqlError(errors, formatted, new GraphQLError("bad")).extensions).toEqual({
            code: "ERRORS_OPERATION_INVALID",
            kind: "invalid",
            params: {},
        })
        expect(errors.describe).not.toHaveBeenCalled()
    })

    it("describes a failure that is not a GraphQL error", () => {
        const errors = mock<ErrorsService>()
        const internal: ErrorDescription = { code: "ERRORS_INTERNAL", kind: "internal", status: 500, params: {} }
        errors.describe.mockReturnValue(internal)
        const failure = new TypeError("boom")

        expect(formatGraphqlError(errors, { message: "boom" }, failure)).toEqual({
            message: "ERRORS_INTERNAL",
            locations: undefined,
            path: undefined,
            extensions: { code: "ERRORS_INTERNAL", kind: "internal", params: {} },
        })
        expect(errors.describe).toHaveBeenCalledWith(failure)
    })
})
