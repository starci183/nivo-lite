import rule from "../lint/template-tier-homes.mjs"
import { at, tester } from "./tester.mjs"

const DEFINE_NODE = 'import { defineNode } from "@nivo-lite/agent-sdk/node"\nexport const n = defineNode'
const TEMPLATE_GRAPH =
    'import { defineTemplateGraph } from "@nivo-lite/agent-sdk/template"\nexport const g = defineTemplateGraph'

tester.run("template-tier-homes", rule, {
    valid: [
        { filename: at("packages/blocks-core/src/shared/nodes/core/if.node.ts"), code: DEFINE_NODE },
        { filename: at("packages/agent-sdk/src/node/node.ts"), code: DEFINE_NODE },
        { filename: at("be/src/modules/domain/agent-graphs/graph.service.ts"), code: DEFINE_NODE },
        { filename: at("be/src/tests/fixtures/builders/graph.builder.ts"), code: TEMPLATE_GRAPH },
        { filename: at("be/src/modules/domain/agent-graphs/graph.service.spec.ts"), code: TEMPLATE_GRAPH },
        { filename: at("packages/blocks-core/src/agents/sales/graphs/consult.graph.ts"), code: TEMPLATE_GRAPH },
        {
            filename: at("be/src/modules/domain/x/x.policy.ts"),
            code: 'import type { defineTemplateNode } from "@nivo-lite/agent-sdk/template"',
        },
    ],
    invalid: [
        {
            filename: at("packages/blocks-core/src/agents/sales/nodes/care.node.ts"),
            code: DEFINE_NODE,
            errors: [{ messageId: "nodeTier" }],
        },
        {
            filename: at("packages/nivo-web-core/src/nodes/webdesk/ticket.node.ts"),
            code: DEFINE_NODE,
            errors: [{ messageId: "nodeTier" }],
        },
        {
            filename: at("packages/blocks-core/src/index.ts"),
            code: 'export { defineNode } from "@nivo-lite/agent-sdk/node"',
            errors: [{ messageId: "nodeTier" }],
        },
        {
            filename: at("be/src/modules/domain/x/x.service.ts"),
            code: TEMPLATE_GRAPH,
            errors: [{ messageId: "templateTier" }],
        },
        {
            filename: at("be/src/modules/domain/x/x.policy.ts"),
            code: 'import { defineTemplateAgent, defineTemplateNode } from "@nivo-lite/agent-sdk/template"\nexport const a = [defineTemplateAgent, defineTemplateNode]',
            errors: [{ messageId: "templateTier" }, { messageId: "templateTier" }],
        },
    ],
})
