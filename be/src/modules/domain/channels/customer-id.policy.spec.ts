import { Test } from "@nestjs/testing"
import { customerIdOf } from "./customer-id.policy"

/** The policy as one provider, read through the Nest testing module. */
class CustomerIdSubject {
    readonly customerIdOf = customerIdOf
}

const build = async (): Promise<CustomerIdSubject> => {
    const moduleRef = await Test.createTestingModule({ providers: [CustomerIdSubject] }).compile()
    return moduleRef.get(CustomerIdSubject)
}

describe("customerIdOf", () => {
    it("is the id itself when it carries no archive suffix", async () => {
        const subject = await build()

        expect(subject.customerIdOf("user-1")).toBe("user-1")
    })

    it("is the part before the colon of an archived conversation", async () => {
        const subject = await build()

        expect(subject.customerIdOf("user-1:1700000000")).toBe("user-1")
    })

    it("reads the suffix of the final line only, so earlier line breaks keep their stored text", async () => {
        const subject = await build()

        expect(subject.customerIdOf("a:b\nuser-1:1700000000")).toBe("a:b\nuser-1")
        expect(subject.customerIdOf("a b:c")).toBe("a b")
    })
})
