import { strict as assert } from "node:assert"
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { test } from "node:test"
import { NIVO_VERB, ROOT } from "../support/lint-shared.mjs"
import rule from "../lint/tool-ids-from-names.mjs"
import { at, tester } from "./tester.mjs"

const file = at("packages/blocks-core/src/nodes/sales/example.node.ts")

tester.run("tool-ids-from-names", rule, {
    valid: [
        {
            filename: file,
            code: 'import { TOOL } from "@nivo-lite/agent-sdk/names"\nconst tools = [TOOL.customerMessageSend]',
        },
        { filename: file, code: 'const key = "accounting.reconcile"' },
        { filename: file, code: 'const prose = "calls nivo.tool.customer.message.send when asked"' },
        { filename: file, code: "const path = `steps.${step}.output`" },
        { filename: file, code: 'const notAVerb = "nivo.tool"' },
        // A generated names map and a spec are not judged (the old manifest's `excludes`, now inside the rule).
        {
            filename: at("packages/nivo-web-core/src/vocabulary/crm-tool-names.generated.ts"),
            code: 'export const CRM = { customerGet: "nivo.tool.crm.get.customers" }',
        },
        { filename: at("packages/blocks-core/src/nodes/sales/example.node.spec.ts"), code: 'const id = "nivo.tool.order.get"' },
        { filename: at("packages/blocks-core/src/views/example.spec.tsx"), code: 'const id = "nivo.api.crm.get.customers"' },
    ],
    invalid: [
        { filename: file, code: 'const tools = ["nivo.tool.customer.message.send"]', errors: [{ messageId: "typed" }] },
        { filename: file, code: 'const verb = "nivo.trigger.clock.tick"', errors: [{ messageId: "typed" }] },
        { filename: file, code: 'const read = "nivo.api.crm.get.customers"', errors: [{ messageId: "typed" }] },
        { filename: file, code: "const id = `nivo.tool.order.get`", errors: [{ messageId: "typed" }] },
        { filename: file, code: "const id = `nivo.tool.crm.${operation}`", errors: [{ messageId: "built" }] },
        { filename: file, code: 'type Id = "nivo.tool.order.get"', errors: [{ messageId: "typed" }] },
    ],
})

// The copy of the id grammar equals the SDK's `levelOf` (packages/agent-sdk/src/schema/namespaced.ts) when the SDK is built.
const SDK_SCHEMA = resolve(ROOT, "packages", "agent-sdk", "dist", "schema", "index.js")
test(
    "the copied NIVO_VERB agrees with the built SDK's levelOf",
    { skip: !existsSync(SDK_SCHEMA) && "agent-sdk not built" },
    () => {
        const { levelOf } = createRequire(import.meta.url)(SDK_SCHEMA)
        const samples = [
            "nivo.tool.customer.message.send",
            "nivo.api.crm.get.customers-code-balance",
            "nivo.trigger.clock.tick",
            "nivo.tool.a.b.c.d",
            "nivo.tool",
            "nivo.tool.Lead.send",
            "nivo.tool.lead_message",
            "nivo.tool.9lead",
        ]
        for (const sample of samples) assert.equal(NIVO_VERB.test(sample), levelOf(sample) !== null, sample)
    },
)
