import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { IsString, validateSync } from "class-validator"
import { ValidateWhenDefined } from "./validate-when-defined.mapper"

describe("ValidateWhenDefined", () => {
    const DECORATOR = Symbol("ValidateWhenDefined")

    let subject: typeof ValidateWhenDefined

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
            providers: [{ provide: DECORATOR, useValue: ValidateWhenDefined }],
        }).compile()
        subject = moduleRef.get<typeof ValidateWhenDefined>(DECORATOR)
    })

    it("skips validation only for undefined", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: undefined }))).toEqual([])
    })

    it("still validates null", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: null }))).toEqual([
            expect.objectContaining({ property: "value", constraints: { isString: "value must be a string" } }),
        ])
    })

    it("accepts strings and refuses other supplied values", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: "" }))).toEqual([])
        expect(validateSync(plainToInstance(TextInput(), { value: false }))).toHaveLength(1)
    })
})
