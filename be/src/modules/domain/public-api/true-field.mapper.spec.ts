import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { IsBoolean, validateSync } from "class-validator"
import { TrueField } from "./true-field.mapper"

describe("TrueField", () => {
    const DECORATOR = Symbol("TrueField")

    let subject: typeof TrueField

    const FieldInput = () => {
        class Input {
            @subject()
            value?: unknown
        }
        return Input
    }

    const TextInput = () => {
        class Input {
            @subject()
            @IsBoolean()
            value?: unknown
        }
        return Input
    }

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: DECORATOR, useValue: TrueField }],
        }).compile()
        subject = moduleRef.get<typeof TrueField>(DECORATOR)
    })

    it.each([
        [true, true],
        ["true", true],
        [false, false],
        ["false", false],
        ["TRUE", false],
        [1, false],
        [null, false],
        [undefined, false],
    ])("transforms %p into %p", (value, expected) => {
        expect(plainToInstance(FieldInput(), { value }).value).toEqual(expected)
    })

    it("keeps an omitted field absent", () => {
        expect(plainToInstance(FieldInput(), {}).value).toBeUndefined()
    })

    it("validates transformed booleans through the DTO validators", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: "true" }))).toEqual([])
        expect(validateSync(plainToInstance(TextInput(), { value: null }))).toEqual([])
        expect(validateSync(plainToInstance(TextInput(), {}))).toHaveLength(1)
    })
})
