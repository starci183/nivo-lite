import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { LanggraphErrorCode } from "./errors/langgraph.error"
import { parseLanggraphConfig } from "./langgraph.config"
import { requireNoTracing, TRACING_SWITCHES } from "./tracing-guard.policy"

/** The members of the subject under test. */
interface Subject {
    readonly parseLanggraphConfig: typeof parseLanggraphConfig
    readonly requireNoTracing: typeof requireNoTracing
}

const SUBJECT = Symbol("tracing-guard.policy")

/** The parser, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseLanggraphConfig, requireNoTracing } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("tracing-guard.policy", () => {
    it("lets an environment with no switch through and refuses the first one that is set", async () => {
        const subject = await build()

        expect(() => subject.requireNoTracing(() => false)).not.toThrow()
        expect(() => subject.requireNoTracing((key) => key.startsWith("LANGCHAIN_"))).toThrow(
            expect.objectContaining({ code: LanggraphErrorCode.TracingForbidden, params: { key: "LANGCHAIN_TRACING" } }),
        )
    })

    it("boots with no tracing switch set and takes the default bounds", async () => {
        const subject = await build()

        expect(subject.parseLanggraphConfig(new EnvSource({}))).toEqual({ compiledMax: 200, stepLimit: 500 })
    })

    it("reads the bounds the app names", async () => {
        const subject = await build()

        expect(
            subject.parseLanggraphConfig(new EnvSource({ LANGGRAPH_COMPILED_MAX: "12", LANGGRAPH_STEP_LIMIT: "40" })),
        ).toEqual({ compiledMax: 12, stepLimit: 40 })
    })

    it("guards exactly the four switches LangChain reads", () => {
        expect(TRACING_SWITCHES).toEqual([
            "LANGSMITH_TRACING",
            "LANGSMITH_TRACING_V2",
            "LANGCHAIN_TRACING",
            "LANGCHAIN_TRACING_V2",
        ])
    })

    it.each(TRACING_SWITCHES.flatMap((key) => [[key, "true"] as const, [key, "false"] as const]))(
        "refuses to boot when %s is set to %s, naming the key",
        async (key, value) => {
            const subject = await build()

            expect(() => subject.parseLanggraphConfig(new EnvSource({ [key]: value }))).toThrow(
                expect.objectContaining({ code: LanggraphErrorCode.TracingForbidden, params: { key } }),
            )
        },
    )

    it("treats an empty switch as not set, as the environment reader does", async () => {
        const subject = await build()

        expect(subject.parseLanggraphConfig(new EnvSource({ LANGSMITH_TRACING: "" }))).toEqual({ compiledMax: 200, stepLimit: 500 })
    })
})
