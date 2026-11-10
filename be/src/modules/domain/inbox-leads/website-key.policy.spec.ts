import { Test } from "@nestjs/testing"
import { customerKeyOf, isAnswerable, newSiteKey, presented } from "./website-key.policy"

const POLICY = Symbol("./website-key.policy")
type PolicySubject = {
    customerKeyOf: typeof customerKeyOf
    isAnswerable: typeof isAnswerable
    newSiteKey: typeof newSiteKey
    presented: typeof presented
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { customerKeyOf, isAnswerable, newSiteKey, presented } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

const base = { name: null, phone: null, email: null, message: null }

describe("website intake policy", () => {
    it("issues a key the database accepts", async () => {
        const { subject } = await buildSubject()

        expect(subject.newSiteKey()).toMatch(/^[a-z0-9]{12,40}$/)
        expect(subject.newSiteKey()).not.toBe(subject.newSiteKey())
    })

    it("treats a blank field as missing", async () => {
        const { subject } = await buildSubject()

        expect(subject.presented(null)).toBeNull()
        expect(subject.presented("  ")).toBeNull()
        expect(subject.presented(" An ")).toBe("An")
    })

    it("answers only a phone, an email or a message", async () => {
        const { subject } = await buildSubject()

        expect(subject.isAnswerable(base)).toBe(false)
        expect(subject.isAnswerable({ ...base, name: "An" })).toBe(false)
        expect(subject.isAnswerable({ ...base, message: "  " })).toBe(false)
        expect(subject.isAnswerable({ ...base, phone: "0900000001" })).toBe(true)
    })

    it("groups under the phone digits first, then the email, then the visitor", async () => {
        const { subject } = await buildSubject()

        expect(subject.customerKeyOf({ ...base, phone: "0900 000 001", email: "A@x.test" }, "v1", "e1")).toBe(
            "phone:0900000001",
        )
        expect(subject.customerKeyOf({ ...base, email: " A@x.test " }, "v1", "e1")).toBe("email:a@x.test")
        expect(subject.customerKeyOf(base, "v1", "e1")).toBe("web:v1")
        expect(subject.customerKeyOf(base, " ", "e1")).toBe("web:e1")
        expect(subject.customerKeyOf(base, null, "e1")).toBe("web:e1")
    })
})
