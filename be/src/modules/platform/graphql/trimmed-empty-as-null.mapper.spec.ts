import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { IsOptional, IsString, validateSync } from "class-validator"
import { TrimmedEmptyAsNull } from "./trimmed-empty-as-null.mapper"

describe("TrimmedEmptyAsNull", () => {
    const DECORATOR = Symbol("TrimmedEmptyAsNull")

    let subject: typeof TrimmedEmptyAsNull

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
            providers: [{ provide: DECORATOR, useValue: TrimmedEmptyAsNull }],
        }).compile()
        subject = moduleRef.get<typeof TrimmedEmptyAsNull>(DECORATOR)
    })

    it.each([
        ["", null],
        [" \t ", null],
        [" value ", " value "],
        [null, null],
        [undefined, undefined],
        [42, 42],
        [false, false],
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
