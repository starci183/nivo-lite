import { Test } from "@nestjs/testing"
import { commandIdOf } from "./command.policy"

const SUBJECT = Symbol("command.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { commandIdOf } }],
    }).compile()
    return moduleRef.get<{ commandIdOf: typeof commandIdOf }>(SUBJECT)
}

describe("commandIdOf", () => {
    it("answers none for a payload that is not an object", async () => {
        const subject = await buildSubject()

        expect(subject.commandIdOf("command")).toBeNull()
        expect(subject.commandIdOf(3)).toBeNull()
        expect(subject.commandIdOf(true)).toBeNull()
        expect(subject.commandIdOf(undefined)).toBeNull()
    })

    it("answers none for a null payload", async () => {
        const subject = await buildSubject()

        expect(subject.commandIdOf(null)).toBeNull()
    })

    it("answers none for an object without a command id", async () => {
        const subject = await buildSubject()

        expect(subject.commandIdOf({})).toBeNull()
    })

    it("answers none for a command id that is not a string", async () => {
        const subject = await buildSubject()

        expect(subject.commandIdOf({ commandId: 3 })).toBeNull()
    })

    it("answers none for a string that is not a uuid", async () => {
        const subject = await buildSubject()

        expect(subject.commandIdOf({ commandId: "not-a-uuid" })).toBeNull()
    })

    it("answers a valid lower case uuid as it is", async () => {
        const subject = await buildSubject()

        expect(subject.commandIdOf({ commandId: "a1b2c3d4-e5f6-4789-abcd-0123456789ab" })).toBe(
            "a1b2c3d4-e5f6-4789-abcd-0123456789ab",
        )
    })

    it("answers a valid upper case uuid as it is", async () => {
        const subject = await buildSubject()

        expect(subject.commandIdOf({ commandId: "A1B2C3D4-E5F6-4789-ABCD-0123456789AB" })).toBe(
            "A1B2C3D4-E5F6-4789-ABCD-0123456789AB",
        )
    })
})
