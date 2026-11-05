import { Test } from "@nestjs/testing"
import { likeContains } from "./like-operand.policy"

const LIKE_OPERAND: unique symbol = Symbol("entity-engine.like-operand")

interface LikeOperandPolicy {
    readonly likeContains: typeof likeContains
}

const build = async (): Promise<LikeOperandPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: LIKE_OPERAND, useFactory: (): LikeOperandPolicy => ({ likeContains }) }],
    }).compile()
    return moduleRef.get<LikeOperandPolicy>(LIKE_OPERAND)
}

describe("likeContains", () => {
    it("puts plain text between percent signs", async () => {
        const policy = await build()

        expect(policy.likeContains("an nguyen")).toBe("%an nguyen%")
    })

    it("escapes the pattern characters so they stand for themselves", async () => {
        const policy = await build()

        expect(policy.likeContains("50%_off\\")).toBe("%50\\%\\_off\\\\%")
    })
})
