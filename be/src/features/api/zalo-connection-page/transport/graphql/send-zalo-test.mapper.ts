import type { SendZaloTestRequest } from "../../application/send-zalo-test.contracts"
import type { ZaloTestSendResult } from "@modules/domain/channels"
import type { SendZaloTestInput } from "./dto/send-zalo-test.input"
import type { ZaloTestSendType } from "./dto/zalo-test-send.type"

/** Maps the GraphQL arguments of sendZaloTestMessage to the request. */
export const toSendZaloTestRequest = (workspaceId: string, input: SendZaloTestInput): SendZaloTestRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    recipientId: input.recipientId,
    text: input.text,
})

/** Maps the answer of sendZaloTestMessage to the GraphQL type. */
export const toSendZaloTestType = (result: ZaloTestSendResult): ZaloTestSendType => result
