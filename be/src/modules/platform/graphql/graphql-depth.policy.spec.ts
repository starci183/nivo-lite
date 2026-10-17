import { Test } from "@nestjs/testing"
import { buildSchema, parse, validate } from "graphql"
import { depthLimitRule as realDepthLimitRule } from "./graphql-depth.policy"

const SUBJECT = Symbol("graphql-depth.policy")

type Subject = Pick<typeof import("./graphql-depth.policy"), "depthLimitRule">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { depthLimitRule: realDepthLimitRule } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const schema = buildSchema(`
    type Query {
        item: Item
    }

    type Item {
        value: String
        child: Item
    }
`)

const validateDepth = (subject: Subject, source: string, maxDepth = 2) =>
    validate(schema, parse(source), [subject.depthLimitRule(maxDepth)])

describe("depthLimitRule", () => {
    it("accepts an operation nested exactly to the depth limit", async () => {
        const subject = await build()

        const errors = validateDepth(
            subject,
            `
            query {
                item {
                    value
                }
            }
        `,
        )

        expect(errors).toEqual([])
    })
    it("rejects the first selection set deeper than the limit", async () => {
        const subject = await build()

        const errors = validateDepth(
            subject,
            `
            query {
                item {
                    child {
                        value
                    }
                }
            }
        `,
        )

        expect(errors.map((error) => error.message)).toEqual(["Selection depth exceeds 2."])
    })
    it("counts the selection set of a fragment on its own", async () => {
        const subject = await build()

        const errors = validateDepth(
            subject,
            `
                query {
                    ...QueryBits
                }

                fragment QueryBits on Query {
                    item {
                        value
                    }
                }
            `,
            1,
        )

        expect(errors.map((error) => error.message)).toEqual(["Selection depth exceeds 1."])
    })
})
