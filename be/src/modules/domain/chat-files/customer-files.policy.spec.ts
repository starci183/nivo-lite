import { Test } from "@nestjs/testing"
import {
    customerObjectPathOf,
    isCustomerFilePath,
    picturesNotSeenOf,
    withPicturesNotSeen,
} from "./customer-files.policy"

const SUBJECT = Symbol("customer-files.policy")

/** The policy as Nest hands it to a caller. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { customerObjectPathOf, isCustomerFilePath, picturesNotSeenOf, withPicturesNotSeen },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./customer-files.policy")>(SUBJECT)
}

describe("customer files policy", () => {
    it("tells a step the pictures it was not shown as a fact of its input, and adds nothing when it saw them all", async () => {
        const policy = await build()
        expect(policy.withPicturesNotSeen({ text: "this sample" }, 0)).toEqual({ text: "this sample" })
        expect(policy.withPicturesNotSeen({ text: "this sample" }, 1)).toEqual({
            text: "this sample",
            picturesNotSeen: policy.picturesNotSeenOf(1),
        })
        expect(policy.withPicturesNotSeen("this sample", 2)).toEqual({
            input: "this sample",
            picturesNotSeen: policy.picturesNotSeenOf(2),
        })
        expect(policy.picturesNotSeenOf(1).note).toContain("Never say or imply you saw them")
    })

    it("keeps a customer's file under its workspace, one path per message and position", async () => {
        const policy = await build()
        const path = policy.customerObjectPathOf("ws-1", "zalo:m-1", 0, "image/png")
        expect(path).toBe(policy.customerObjectPathOf("ws-1", "zalo:m-1", 0, "image/png"))
        expect(path).not.toBe(policy.customerObjectPathOf("ws-1", "zalo:m-1", 1, "image/png"))
        expect(policy.isCustomerFilePath("ws-1", path)).toBe(true)
        expect(policy.isCustomerFilePath("ws-2", path)).toBe(false)
        expect(policy.isCustomerFilePath("ws-1", "ws-1/chat/customer/../office/x.png")).toBe(false)
    })
})
