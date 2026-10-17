import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { IsString, validateSync } from "class-validator"
import { ValidateWhenNotNull } from "./validate-when-not-null.mapper"

describe("ValidateWhenNotNull", () => {
    const DECORATOR = Symbol("ValidateWhenNotNull")

    let subject: typeof ValidateWhenNotNull

    const TextInput = () => {
        class Input {
            @subject()
            @IsString()
            value?: string | null
        }
        return Input
    }

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: DECORATOR, useValue: ValidateWhenNotNull }],
        }).compile()
        subject = moduleRef.get<typeof ValidateWhenNotNull>(DECORATOR)
    })

    it("skips validation only for null", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: null }))).toEqual([])
    })

    it("still validates undefined", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: undefined }))).toEqual([
            expect.objectContaining({ property: "value", constraints: { isString: "value must be a string" } }),
        ])
    })

    it("accepts strings and refuses other supplied values", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: "" }))).toEqual([])
        expect(validateSync(plainToInstance(TextInput(), { value: false }))).toHaveLength(1)
    })
})
