import { Test } from "@nestjs/testing"
import { TIMER_ARM_SCHEMA } from "./timer-native.schema"

const SUBJECT = Symbol("timer-native.schema")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { TIMER_ARM_SCHEMA } }],
    }).compile()
    return moduleRef.get<{ TIMER_ARM_SCHEMA: typeof TIMER_ARM_SCHEMA }>(SUBJECT)
}

const members = (count: number): Record<string, string> =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${String(index)}`, "v"]))

describe("the timer arm schema", () => {
    it("takes data of 20 members and refuses 21 with the message that names the cause", async () => {
        const { TIMER_ARM_SCHEMA: schema } = await build()
        expect(schema.safeParse({ ref: "r", afterMinutes: 5, data: members(20) }).success).toBe(true)
        const refused = schema.safeParse({ ref: "r", afterMinutes: 5, data: members(21) })
        expect(refused.success).toBe(false)
        expect(refused.error?.issues.map((issue) => issue.message)).toContain("data has too many members")
    })

    it("takes a due moment of 64 characters and refuses a longer one", async () => {
        const { TIMER_ARM_SCHEMA: schema } = await build()
        expect(schema.safeParse({ ref: "r", dueAt: "2026-11-14T09:00:00.1234+07:00" }).success).toBe(true)
        expect(schema.safeParse({ ref: "r", dueAt: `2026-11-14T09:00:00.${"1".repeat(60)}+07:00` }).success).toBe(false)
    })
})
