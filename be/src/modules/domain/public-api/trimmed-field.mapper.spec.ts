import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { IsOptional, IsString, validateSync } from "class-validator"
import { TrimmedField } from "./trimmed-field.mapper"

describe("TrimmedField", () => {
    const DECORATOR = Symbol("TrimmedField")

    let subject: typeof TrimmedField

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
            @IsOptional()
            @IsString()
            value?: unknown
        }
        return Input
    }

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: DECORATOR, useValue: TrimmedField }],
        }).compile()
        subject = moduleRef.get<typeof TrimmedField>(DECORATOR)
    })

    it.each([
        [" value ", "value"],
        ["", ""],
        [42, "42"],
        [0, "0"],
        [null, null],
        [undefined, undefined],
        [false, false],
        [{ nested: true }, { nested: true }],
    ])("transforms %p into %p", (value, expected) => {
        expect(plainToInstance(FieldInput(), { value }).value).toEqual(expected)
    })

    it("keeps an omitted field absent", () => {
        expect(plainToInstance(FieldInput(), {}).value).toBeUndefined()
    })

    it("applies conversion before public DTO validation", () => {
        expect(validateSync(plainToInstance(TextInput(), { value: " text " }))).toEqual([])
        expect(validateSync(plainToInstance(TextInput(), { value: {} }))).toEqual([
            expect.objectContaining({ property: "value", constraints: { isString: "value must be a string" } }),
        ])
    })
})
