import { Test } from "@nestjs/testing"
import { clampPageSize as realClampPageSize, splitPage as realSplitPage } from "./paging.policy"

const SUBJECT = Symbol("paging.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    clampPageSize: realClampPageSize,
                    splitPage: realSplitPage,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        clampPageSize: typeof realClampPageSize
        splitPage: typeof realSplitPage
    }>(SUBJECT)
}

describe("clampPageSize", () => {
    it.each([
        [20, 20],
        [0, 1],
        [-5, 1],
        [500, 100],
        [7.9, 7],
        [Number.NaN, 1],
    ])("turns %s into %s", async (requested, expected) => {
        const subject = await buildSubject()

        expect(subject.clampPageSize(requested)).toBe(expected)
    })
})

describe("splitPage", () => {
    const rowOf = (id: string) => ({ id, cursor_at: `at-${id}` })

    it("cuts the extra row off and points at the last row kept", async () => {
        const subject = await buildSubject()

        expect(subject.splitPage([rowOf("a"), rowOf("b"), rowOf("c")], 2)).toEqual({
            rows: [rowOf("a"), rowOf("b")],
            next: { createdAt: "at-b", id: "b" },
        })
    })

    it("has no next page when the rows fit", async () => {
        const subject = await buildSubject()

        expect(subject.splitPage([rowOf("a"), rowOf("b")], 2)).toEqual({ rows: [rowOf("a"), rowOf("b")], next: null })
    })

    it("has no next page for no rows", async () => {
        const subject = await buildSubject()

        expect(subject.splitPage([], 2)).toEqual({ rows: [], next: null })
    })

    it("has no next page for a zero-size page", async () => {
        const subject = await buildSubject()

        expect(subject.splitPage([rowOf("a")], 0)).toEqual({ rows: [], next: null })
    })
})
