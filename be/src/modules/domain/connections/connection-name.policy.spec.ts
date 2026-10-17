import { Test } from "@nestjs/testing"
import { cleanConnectionName as realCleanConnectionName } from "./connection-name.policy"

const SUBJECT = Symbol("connection-name.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cleanConnectionName: realCleanConnectionName } }],
    }).compile()
    const subject = moduleRef.get<{ cleanConnectionName: typeof realCleanConnectionName }>(SUBJECT)
    const cleanConnectionName = subject.cleanConnectionName
    return { cleanConnectionName }
}

describe("cleanConnectionName", () => {
    it("trims and keeps a valid name", async () => {
        const { cleanConnectionName } = await buildSubject()

        expect(cleanConnectionName("  Shop bot ")).toBe("Shop bot")
    })

    it("cuts a long name to 60 characters", async () => {
        const { cleanConnectionName } = await buildSubject()

        expect(cleanConnectionName("x".repeat(80))).toBe("x".repeat(60))
    })

    it("refuses a name shorter than two characters", async () => {
        const { cleanConnectionName } = await buildSubject()

        expect(cleanConnectionName(" a ")).toBeNull()
        expect(cleanConnectionName("")).toBeNull()
    })
})
