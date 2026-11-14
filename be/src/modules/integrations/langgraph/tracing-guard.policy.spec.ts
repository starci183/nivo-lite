import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EnvSource } from "@modules/platform/config"
import { LanggraphErrorCode } from "./errors/langgraph.error"
import { parseLanggraphConfig } from "./langgraph.config"
import { requireNoTracing, TRACING_SWITCHES } from "./tracing-guard.policy"

/** The members of the subject under test. */
interface Subject {
    readonly parseLanggraphConfig: typeof parseLanggraphConfig
    readonly requireNoTracing: typeof requireNoTracing
}

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("tracing-guard.policy")

/** The parser, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ parseLanggraphConfig, requireNoTracing }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("tracing-guard.policy", () => {
    it("lets an environment with no switch through and refuses the first one that is set", async () => {
        const subject = await build()

        expect(() => subject.requireNoTracing(() => false)).not.toThrow()
        expect(thrownBy(() => subject.requireNoTracing((key) => key.startsWith("LANGCHAIN_")))).toEqual(objectLike({ code: LanggraphErrorCode.TracingForbidden, params: { key: "LANGCHAIN_TRACING" } }))
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

            expect(thrownBy(() => subject.parseLanggraphConfig(new EnvSource({ [key]: value })))).toEqual(objectLike({ code: LanggraphErrorCode.TracingForbidden, params: { key } }))
        },
    )

    it("treats an empty switch as not set, as the environment reader does", async () => {
        const subject = await build()

        expect(subject.parseLanggraphConfig(new EnvSource({ LANGSMITH_TRACING: "" }))).toEqual({ compiledMax: 200, stepLimit: 500 })
    })
})
