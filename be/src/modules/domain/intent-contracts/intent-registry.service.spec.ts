import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { TEST_DOMAIN } from "@tests/fixtures/builders/intent-domain.builder"
import { IntentContractsErrorCode } from "./errors/intent-contracts.error"
import type { IntentFrame } from "./intent-contracts.contracts"
import { requestFrameOf } from "./intent-frames.policy"
import { IntentRegistryService } from "./intent-registry.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [IntentRegistryService] }).compile()
    return moduleRef.get(IntentRegistryService)
}

const ACTIONS = ["reply_customer", "gateway_call", "send_quote"].map((action) => ({ action, amountLimit: false }))

const codeOf = (work: () => void): unknown => {
    try {
        work()
        return null
    } catch (cause) {
        return typeof cause === "object" && cause !== null && "code" in cause ? cause.code : cause
    }
}

const frameWith = (patch: Partial<IntentFrame>): IntentFrame => ({
    ...requestFrameOf("remind", false),
    triggers: ["chat_message"],
    ...patch,
})

describe("IntentRegistryService > a domain", () => {
    it("holds the generic request, its result and its checks before any domain is added", async () => {
        const registry = await build()

        expect(registry.frameOf("send_quote", ACTIONS, "tag")?.result).toBe("agent_request")
        expect(registry.resultSchemaOf("agent_request")).toBeDefined()
        expect(registry.resultSchemaOf("own_turn_pick")).toBeDefined()
        expect(registry.checkOf("action_is_intent")).toBeDefined()
        expect(registry.needsAnswer("customer_message")).toBe(false)
    })

    it("adds the frames, the results and the checks of a domain and answers for them", async () => {
        const registry = await build()

        registry.add(TEST_DOMAIN)

        expect(registry.frameOf("reply_customer", ACTIONS, "customer_message")?.answers).toBe(true)
        expect(registry.frameOf("gateway_call", ACTIONS, "tag")?.ownTurn).toBe(true)
        expect(registry.resultSchemaOf("test_answer")).toBeDefined()
        expect(registry.checkOf("lead_complete")).toBeDefined()
        expect(registry.needsAnswer("customer_message")).toBe(true)
    })

    it("reads an answer against the contracts it was offered", async () => {
        const registry = await build()
        registry.add(TEST_DOMAIN)
        const contract = {
            intent: "reply_customer",
            label: "Answer",
            ownTurn: false,
            task: "",
            limits: [],
            result: "test_answer",
            owns: [],
            checks: ["reply_present"],
        }

        const reading = registry.read(JSON.stringify({ intent: "reply_customer", result: { reply: "Hi" } }), [contract])

        expect(reading).toMatchObject({ kind: "picked", result: { reply: "Hi" } })
        expect(registry.read("{}", [contract])).toMatchObject({ kind: "safe", cause: "invalid_output" })
    })
})

describe("IntentRegistryService > a registration that is wrong throws", () => {
    it("refuses a frame that names a result nobody registered", async () => {
        const registry = await build()

        expect(codeOf(() => registry.add({ frames: [frameWith({ result: "nobody" })], results: {}, checks: {} }))).toBe(
            IntentContractsErrorCode.KeyUnknown,
        )
    })

    it("refuses a frame that names a check nobody registered", async () => {
        const registry = await build()

        expect(
            codeOf(() => registry.add({ frames: [frameWith({ checks: ["nobody"] })], results: {}, checks: {} })),
        ).toBe(IntentContractsErrorCode.KeyUnknown)
    })

    it("refuses a key that is not a bounded lower-case word", async () => {
        const registry = await build()

        expect(
            codeOf(() =>
                registry.add({
                    frames: [],
                    results: Object.fromEntries(
                        Object.values(TEST_DOMAIN.results).map((schema) => ["Not A Key", schema] as const),
                    ),
                    checks: {},
                }),
            ),
        ).toBe(IntentContractsErrorCode.KeyInvalid)
        expect(
            codeOf(() => registry.add({ frames: [frameWith({ result: "Bad Key" })], results: {}, checks: {} })),
        ).toBe(IntentContractsErrorCode.KeyInvalid)
    })

    it("refuses a second result, check or frame under the same key", async () => {
        const registry = await build()
        registry.add(TEST_DOMAIN)

        expect(codeOf(() => registry.add({ frames: [], results: TEST_DOMAIN.results, checks: {} }))).toBe(
            IntentContractsErrorCode.KeyDuplicate,
        )
        expect(codeOf(() => registry.add({ frames: [], results: {}, checks: TEST_DOMAIN.checks }))).toBe(
            IntentContractsErrorCode.KeyDuplicate,
        )
        expect(codeOf(() => registry.add({ frames: TEST_DOMAIN.frames.slice(0, 1), results: {}, checks: {} }))).toBe(
            IntentContractsErrorCode.KeyDuplicate,
        )
    })
})

const lineHitsOf = (path: string, text: string, pattern: RegExp): ReadonlyArray<string> =>
    text.split("\n").flatMap((line, index) => (pattern.test(line) ? [`${path}:${index + 1}: ${line.trim()}`] : []))

/** The words of a domain. The registry, the pipeline and the saga are generic: a domain registers its own contract, checks and facts. */
const BANNED =
    /\b(money|lead|order|booking|loyalty|application|payment|price|invoice)\b|reply_customer|customer_reply|handoff|confirm_/iu

const productionFiles = (folder: string): ReadonlyArray<string> =>
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
        const path = join(folder, entry.name)
        if (entry.isDirectory()) return productionFiles(path)
        return /\.ts$/u.test(entry.name) && !/\.spec\.ts$/u.test(entry.name) ? [path] : []
    })

describe("intent-contracts holds no word of a domain", () => {
    it("has production files to read", () => {
        expect(productionFiles(__dirname).length).toBeGreaterThan(10)
    })

    it("names no domain in any production file, its comments and its messages included", () => {
        const found = productionFiles(__dirname).flatMap((path) => lineHitsOf(path, readFileSync(path, "utf8"), BANNED))

        expect(found).toEqual([])
    })
})
