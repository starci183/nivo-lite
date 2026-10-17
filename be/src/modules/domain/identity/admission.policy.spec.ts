import { Test } from "@nestjs/testing"
import type { Principal } from "@modules/platform/cqrs"
import { admit } from "./admission.policy"
import { IdentityErrorCode } from "./errors/identity.error"
import { PublicReason } from "./identity.contracts"

const SUBJECT = Symbol("admission.policy")
type Subject = { admit: typeof admit }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { admit } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const principal: Principal = { id: "person-1", email: "person-1@example.test", role: "authenticated" }

describe("admit", () => {
    it("admits a public door with its reason, whoever calls", async () => {
        const subject = await build()

        expect(subject.admit({ reason: PublicReason.Health }, undefined)).toSucceedWith(PublicReason.Health)
        expect(subject.admit({ reason: PublicReason.SignedWebhook }, principal)).toSucceedWith(
            PublicReason.SignedWebhook,
        )
    })

    it("admits a verified principal on a door that is not public", async () => {
        const subject = await build()

        expect(subject.admit(undefined, principal)).toSucceedWith(principal)
    })

    it("refuses a door that is not public when no principal was verified", async () => {
        const subject = await build()

        expect(subject.admit(undefined, undefined)).toBeRefused(IdentityErrorCode.Unauthenticated)
    })
})
