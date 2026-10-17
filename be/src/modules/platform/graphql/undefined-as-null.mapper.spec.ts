import { Test } from "@nestjs/testing"
import { plainToInstance } from "class-transformer"
import { IsOptional, IsString, validateSync } from "class-validator"
import { UndefinedAsNull } from "./undefined-as-null.mapper"

describe("UndefinedAsNull", () => {
    const DECORATOR = Symbol("UndefinedAsNull")

    let subject: typeof UndefinedAsNull

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
            providers: [{ provide: DECORATOR, useValue: UndefinedAsNull }],
        }).compile()
        subject = moduleRef.get<typeof UndefinedAsNull>(DECORATOR)
    })

    it.each([
        [null, null],
        [undefined, null],
        ["value", "value"],
        [false, false],
        [0, 0],
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
