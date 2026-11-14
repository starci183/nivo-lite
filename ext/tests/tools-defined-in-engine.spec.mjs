import rule from "../lint/tools-defined-in-engine.mjs"
import { at, tester } from "./tester.mjs"

const DEFINE = 'import { defineTool } from "@nivo-lite/agent-sdk/node"\nexport const t = defineTool({ id: "x.y" })'
const REGISTRY = "export const TOOL_SPECS = { a: {} } as const"

tester.run("tools-defined-in-engine", rule, {
    valid: [
        { filename: at("be/src/modules/domain/tool-specs/tool-specs.policy.ts"), code: REGISTRY },
        { filename: at("be/src/modules/domain/tool-specs/source-tool-spec.policy.ts"), code: DEFINE },
        { filename: at("be/src/tests/fixtures/builders/probe.builder.ts"), code: DEFINE },
        { filename: at("be/src/modules/integrations/langgraph/replay.adapter.spec.ts"), code: DEFINE },
        { filename: at("packages/agent-sdk/src/node/tools.spec.ts"), code: DEFINE },
        { filename: at("packages/blocks-core/src/vocabulary/tools.ts"), code: DEFINE },
        { filename: at("packages/nivo-web-core/src/vocabulary/crm-tools.ts"), code: DEFINE },
        {
            filename: at("packages/blocks-core/src/nodes/sales/x.node.ts"),
            code: "const READ_SPECS = { a: {} }\nexport const r = READ_SPECS",
        },
    ],
    invalid: [
        {
            filename: at("packages/nivo-web-core/src/vocabulary/mail-tools.ts"),
            code: DEFINE,
            errors: [{ messageId: "defineTool" }],
        },
        {
            filename: at("packages/blocks-core/src/modules/x.spec.ts"),
            code: DEFINE,
            errors: [{ messageId: "defineTool" }],
        },
        {
            filename: at("be/src/modules/domain/tools/x.policy.ts"),
            code: DEFINE,
            errors: [{ messageId: "defineTool" }],
        },
        {
            filename: at("be/src/modules/domain/tools/x.policy.ts"),
            code: REGISTRY,
            errors: [{ messageId: "registry" }],
        },
        {
            filename: at("packages/nivo-web-core/src/x.ts"),
            code: "export const CRM_TOOL_SPECS = { a: {} } satisfies object",
            errors: [{ messageId: "registry" }],
        },
    ],
})
