import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { SendMessageRequest } from "./dto/send-message.request"
import { toSendMessageRequest as realToRequest, toSendMessageResponse as realToResponse } from "./send-message.mapper"

const SUBJECT = Symbol("send-message.mapper")
type Subject = { toRequest: typeof realToRequest; toResponse: typeof realToResponse }

const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toRequest: realToRequest, toResponse: realToResponse } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ROUTE = "6f1e2d3c-4b5a-4968-8778-695a4b3c2d1e"

/** The properties a body is refused for, under the global pipe's rules (`whitelist` and `forbidNonWhitelisted`, http-security). */
const refusedOf = async (body: object): Promise<ReadonlyArray<string>> =>
    (await validate(plainToInstance(SendMessageRequest, body), { whitelist: true, forbidNonWhitelisted: true })).map((error) => error.property)

describe("POST /api/v1/messages, the public field route_id", () => {
    it("maps `route_id` of the request to the route the command sends to, and answers the route as `route_id`", async () => {
        const { toRequest, toResponse } = await buildSubject()

        expect(toRequest("Bearer k", "idem-1", { text: "Chao", route_id: ROUTE })).toEqual({
            authorization: "Bearer k",
            text: "Chao",
            conversationId: ROUTE,
            requireApproval: undefined,
            idempotencyKey: "idem-1",
        })
        expect(toResponse({ conversationId: ROUTE, status: "queued" })).toEqual({ data: { route_id: ROUTE, status: "queued" } })
    })

    it("accepts a body that names the route as `route_id`", async () => {
        await expect(refusedOf({ text: "Chao", route_id: ROUTE })).resolves.toEqual([])
    })

    it("refuses the old name `conversation_id`: there is no alias", async () => {
        await expect(refusedOf({ text: "Chao", conversation_id: ROUTE })).resolves.toEqual(expect.arrayContaining(["route_id", "conversation_id"]))
    })
})
