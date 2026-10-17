import { Test } from "@nestjs/testing"
import type { ExecutionContext } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import type { OperationRequest } from "./http-security.contracts"
import { requestOf } from "./execution-request.mapper"

const SUBJECT = Symbol("execution-request.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { requestOf } }],
    }).compile()
    return moduleRef.get<typeof import("./execution-request.mapper")>(SUBJECT)
}

const request: OperationRequest = { headers: {}, method: "GET", ip: "127.0.0.1" }

describe("requestOf", () => {
    it("reads the request from an HTTP execution context", async () => {
        const subject = await buildSubject()

        const http = mock<ReturnType<ExecutionContext["switchToHttp"]>>()
        http.getRequest.mockReturnValue(request)
        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("http")
        context.switchToHttp.mockReturnValue(http)

        expect(subject.requestOf(context)).toBe(request)
        expect(context.getArgs).not.toHaveBeenCalled()
    })

    it("reads the request from a GraphQL execution context", async () => {
        const subject = await buildSubject()

        const context = mock<ExecutionContext>()
        context.getType.mockReturnValue("graphql")
        context.getArgs.mockReturnValue([undefined, {}, { req: request }, undefined])

        expect(subject.requestOf(context)).toBe(request)
        expect(context.switchToHttp).not.toHaveBeenCalled()
    })
})
