import { NotFoundException } from "@nestjs/common"
import { GraphQLError } from "graphql"
import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Logger } from "@modules/platform/logging"
import { LOGGER } from "@modules/platform/logging"
import type { MessageCatalog } from "@modules/platform/i18n"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { DomainError } from "./domain.error"
import { ERROR_REPORTER, ERRORS_OPTIONS } from "./errors.decorators"
import { ErrorsError, ErrorsErrorCode } from "./errors/errors.error"
import { ErrorsLogEvent } from "./errors.log-events"
import type { ErrorKindTable } from "./errors.contracts"
import type { ErrorReporter } from "./errors.port"
import { ErrorsService } from "./errors.service"

type CalendarsErrorCode = "CALENDARS_NOT_FOUND"

class CalendarsError extends DomainError<CalendarsErrorCode> {}

const CALENDARS_ERROR_KINDS: ErrorKindTable = { CALENDARS_NOT_FOUND: "not-found" }

const build = async (kinds: ReadonlyArray<ErrorKindTable>) => {
    const catalog = mock<MessageCatalog>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ErrorsService,
            { provide: ERRORS_OPTIONS, useValue: { kinds } },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: ERROR_REPORTER, useValue: mock<ErrorReporter>({ report: () => Promise.resolve() }) },
        ],
    }).compile()
    return { errors: moduleRef.get(ErrorsService), catalog, logger }
}

describe("ErrorsService", () => {
    describe("describe", () => {
        it("keeps the code, kind and params of a declared domain error", async () => {
            const { errors, logger } = await build([CALENDARS_ERROR_KINDS])
            const declared = new CalendarsError({ code: "CALENDARS_NOT_FOUND", params: { id: "calendar-1" } })

            expect(errors.describe(declared)).toEqual({
                code: "CALENDARS_NOT_FOUND",
                kind: "not-found",
                status: 404,
                params: { id: "calendar-1" },
            })
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("keeps the code of an error the errors capability itself declares", async () => {
            const { errors } = await build([])

            expect(errors.describe(new ErrorsError({ code: ErrorsErrorCode.Internal }))).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                status: 500,
                params: {},
            })
        })

        it("masks a domain error no composed capability declared and logs it", async () => {
            const { errors, logger } = await build([])
            const undeclared = new CalendarsError({ code: "CALENDARS_NOT_FOUND" })

            expect(errors.describe(undeclared)).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                status: 500,
                params: {},
            })
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, undeclared, { scope: "api" })
        })

        it("masks any other failure and logs it", async () => {
            const { errors, logger } = await build([])
            const failure = new Error("boom")

            expect(errors.describe(failure).code).toBe("ERRORS_INTERNAL")
            expect(logger.error).toHaveBeenCalledWith(ErrorsLogEvent.Unhandled, failure, { scope: "api" })
        })

        it("records an unhandled failure with the reporter under the site the transport names", async () => {
            const reporter = mock<ErrorReporter>({ report: () => Promise.resolve() })
            const moduleRef = await Test.createTestingModule({
                providers: [
                    ErrorsService,
                    { provide: ERRORS_OPTIONS, useValue: { kinds: [] } },
                    { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>() },
                    { provide: LOGGER, useValue: mock<Logger>() },
                    { provide: ERROR_REPORTER, useValue: reporter },
                ],
            }).compile()
            const failure = new Error("boom")

            moduleRef.get(ErrorsService).describe(failure, { scope: "http", context: { route: "/v1/hooks" } })

            expect(reporter.report).toHaveBeenCalledWith("http", failure, { route: "/v1/hooks" })
        })
    })

    describe("describe of the framework not-found", () => {
        it("answers the not-found of an unmatched route as not-found, without logging it", async () => {
            const { errors, logger } = await build([])

            expect(errors.describe(new NotFoundException())).toEqual({
                code: ErrorsErrorCode.RouteNotFound,
                kind: "not-found",
                status: 404,
                params: {},
            })
            expect(logger.error).not.toHaveBeenCalled()
        })
    })

    describe("describeInvalidOperation", () => {
        it("describes a malformed operation as invalid", async () => {
            const { errors } = await build([])

            expect(errors.describeInvalidOperation()).toEqual({
                code: "ERRORS_OPERATION_INVALID",
                kind: "invalid",
                status: 400,
                params: {},
            })
        })
    })

    describe("formatError", () => {
        it("answers the code, kind and params of the original error of a GraphQL failure", async () => {
            const { errors } = await build([CALENDARS_ERROR_KINDS])
            const original = new CalendarsError({ code: "CALENDARS_NOT_FOUND", params: { id: "calendar-1" } })
            const graphql = new GraphQLError(original.code, { originalError: original, path: ["calendar"] })

            expect(errors.formatError(graphql.toJSON(), graphql)).toEqual({
                message: "CALENDARS_NOT_FOUND",
                locations: undefined,
                path: ["calendar"],
                extensions: { code: "CALENDARS_NOT_FOUND", kind: "not-found", params: { id: "calendar-1" } },
            })
        })

        it("answers an invalid operation for a GraphQL failure without an original error", async () => {
            const { errors } = await build([])
            const graphql = new GraphQLError(ErrorsErrorCode.OperationInvalid)

            expect(errors.formatError(graphql.toJSON(), graphql).extensions).toEqual({
                code: "ERRORS_OPERATION_INVALID",
                kind: "invalid",
                params: {},
            })
        })

        it("masks a failure that is not a GraphQL error", async () => {
            const { errors } = await build([])
            const graphql = new GraphQLError(ErrorsErrorCode.Internal)

            expect(errors.formatError(graphql.toJSON(), new Error("boom")).extensions).toEqual({
                code: "ERRORS_INTERNAL",
                kind: "internal",
                params: {},
            })
        })
    })

    describe("text", () => {
        it("returns the catalog text of the code in the locale", async () => {
            const { errors, catalog } = await build([])
            catalog.get.mockReturnValue("Calendar calendar-1 was not found")

            expect(errors.text("CALENDARS_NOT_FOUND", { id: "calendar-1" }, "en")).toBe(
                "Calendar calendar-1 was not found",
            )
            expect(catalog.get).toHaveBeenCalledWith("errors.CALENDARS_NOT_FOUND", { id: "calendar-1" }, "en")
        })

        it("returns the text of the internal error when the code has no catalog entry", async () => {
            const { errors, catalog } = await build([])
            catalog.get.mockImplementation((key) => (key === "errors.ERRORS_INTERNAL" ? "Something broke" : key))

            expect(errors.text("CALENDARS_NOT_FOUND", {}, "vi")).toBe("Something broke")
            expect(catalog.get).toHaveBeenLastCalledWith("errors.ERRORS_INTERNAL", {}, "vi")
        })
    })
})
