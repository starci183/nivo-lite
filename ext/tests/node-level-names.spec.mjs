import rule from "../lint/node-level-names.mjs"
import { at, tester } from "./tester.mjs"

const nodeFile = at("packages/blocks-core/src/nodes/sales/example.node.ts")
const plainFile = at("packages/blocks-core/src/modules/sales/example.ts")
const graphFile = at("packages/blocks-core/src/modules/sales/template/example.graph.ts")
const feFile = at("fe/apps/web/src/modules/example/example.ts")
const specFile = at("packages/blocks-core/src/modules/sales/specs/sales.workbench.ts")

const TEMPLATE = 'import { defineTemplateGraph, defineTemplateNode, trigger } from "@nivo-lite/agent-sdk/template"\n'

tester.run("node-level-names", rule, {
    valid: [
        {
            filename: nodeFile,
            code: 'import { TOOL } from "@nivo-lite/agent-sdk/names"\nexport const tools = [TOOL.orderGet]',
        },
        {
            filename: nodeFile,
            code: 'import type { ApiVerb } from "@nivo-lite/agent-sdk/names"\nexport type V = ApiVerb',
        },
        {
            filename: nodeFile,
            code: 'import { CRM, CRM_PROVIDER } from "../../vocabulary/crm-tool-names.generated"\nexport const t = [CRM.customerGet, CRM_PROVIDER]',
        },
        {
            filename: plainFile,
            code: 'import { API } from "@nivo-lite/agent-sdk/names"\nexport const reads = [API.crm]',
        },
        {
            filename: graphFile,
            code: `${TEMPLATE}import { TRIGGER } from "@nivo-lite/agent-sdk/names"\nexport const g = defineTemplateGraph({ triggers: [trigger(TRIGGER.workflowCalled)] })`,
        },
        { filename: plainFile, code: `${TEMPLATE}const verb = "x"\nexport const t = trigger(verb)` },
        {
            filename: feFile,
            code: 'import { API } from "@nivo-lite/agent-sdk/names"\nimport { CRM_API } from "@nivo-lite/nivo-web-core/crm-tool-names.generated"\nexport const r = [API, CRM_API]',
        },
        { filename: specFile, code: 'import { API } from "@nivo-lite/agent-sdk/names"\nexport const r = API' },
    ],
    invalid: [
        {
            filename: nodeFile,
            code: 'import { API } from "@nivo-lite/agent-sdk/names"\nexport const r = API.crm',
            errors: [{ messageId: "nodeApi" }],
        },
        {
            filename: nodeFile,
            code: 'import { CRM_API } from "../../vocabulary/crm-tool-names.generated"\nexport const r = CRM_API',
            errors: [{ messageId: "nodeApi" }],
        },
        {
            filename: plainFile,
            code: `${TEMPLATE}import { API } from "@nivo-lite/agent-sdk/names"\nexport const n = defineTemplateNode({ tools: [API.crm] })`,
            errors: [{ messageId: "nodeApi" }],
        },
        {
            filename: graphFile,
            code: `${TEMPLATE}const verb = "x"\nexport const g = defineTemplateGraph({ triggers: [trigger(verb)] })`,
            errors: [{ messageId: "triggerVerb" }],
        },
        {
            filename: graphFile,
            code: `${TEMPLATE}import { TOOL } from "@nivo-lite/agent-sdk/names"\nexport const g = defineTemplateGraph({ triggers: [trigger(TOOL.orderGet)] })`,
            errors: [{ messageId: "triggerVerb" }],
        },
        {
            filename: feFile,
            code: 'import { TOOL } from "@nivo-lite/agent-sdk/names"\nexport const t = TOOL',
            errors: [{ messageId: "interfaceTool" }],
        },
        {
            filename: feFile,
            code: 'import { TOOL } from "@nivo-lite/blocks-core"\nexport const t = TOOL',
            errors: [{ messageId: "interfaceTool" }],
        },
        {
            filename: specFile,
            code: 'import { CRM } from "../../../vocabulary/crm-tool-names.generated"\nexport const t = CRM',
            errors: [{ messageId: "interfaceTool" }],
        },
    ],
})
