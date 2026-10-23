import { Test } from "@nestjs/testing"
import { credentialStateOf } from "./credential-state.policy"

const SUBJECT = Symbol("credential-state.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { credentialStateOf } }],
    }).compile()
    return moduleRef.get<{ credentialStateOf: typeof credentialStateOf }>(SUBJECT)
}

describe("credential-state policy", () => {
    it("keeps the three stored states", async () => {
        const subject = await buildSubject()

        expect(["none", "needed", "set"].map(subject.credentialStateOf)).toEqual(["none", "needed", "set"])
    })

    it("reads an unknown state as needed, so nothing is sent without a credential by mistake", async () => {
        const subject = await buildSubject()

        expect(subject.credentialStateOf("legacy")).toBe("needed")
    })
})
