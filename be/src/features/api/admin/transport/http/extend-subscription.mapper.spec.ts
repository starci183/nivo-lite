import { builder } from "@starci/jest-preset"
import type { ExtendSubscriptionResult } from "../../application/extend-subscription.contracts"
import { toExtendSubscriptionRequest, toExtendSubscriptionResponse } from "./extend-subscription.mapper"

const resultOf = builder<ExtendSubscriptionResult>({ paidUntil: "2026-11-13T10:00:00.000Z" })

describe("extend-subscription mapper", () => {
    it("adds the workspace to the requested extension", () => {
        expect(toExtendSubscriptionRequest("workspace-1", { days: 31 })).toEqual({
            workspaceId: "workspace-1",
            days: 31,
        })
    })

    it("returns the extended subscription unchanged", () => {
        const result = resultOf()

        expect(toExtendSubscriptionResponse(result)).toBe(result)
        expect(toExtendSubscriptionResponse(result)).toEqual({ paidUntil: "2026-11-13T10:00:00.000Z" })
    })
})
