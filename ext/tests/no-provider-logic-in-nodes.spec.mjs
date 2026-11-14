import rule from "../lint/no-provider-logic-in-nodes.mjs"
import { at, tester } from "./tester.mjs"

const nodeFile = at("packages/blocks-core/src/agents/sales/nodes/example.node.ts")
const controlFile = at("packages/blocks-core/src/shared/nodes/core/if.node.ts")
const controlSpec = at("packages/blocks-core/src/shared/nodes/core/call-workflow.node.spec.ts")
const pluginControlLike = at("packages/nivo-web-core/src/nodes/core/hand-off.node.ts")
const plainFile = at("packages/blocks-core/src/agents/sales/example.ts")

const NAMES = 'import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"\n'
const SDK = 'import { defineEffect, defineNode, defineTool } from "@nivo-lite/agent-sdk/node"\n'
const TEMPLATE = 'import { defineTemplateNode } from "@nivo-lite/agent-sdk/template"\n'

tester.run("no-provider-logic-in-nodes", rule, {
    valid: [
        {
            filename: nodeFile,
            code: `${NAMES}${TEMPLATE}export const n = defineTemplateNode({ tools: [TOOL.orderGet], accounts: [{ provider: PROVIDER.sepay }] })`,
        },
        { filename: controlFile, code: `${SDK}export const n = defineNode({ id: "core.if" })` },
        {
            filename: plainFile,
            code: `${NAMES}${SDK}export const t = defineTool({}); export const same = (p: string) => p === PROVIDER.sepay`,
        },
        { filename: nodeFile, code: `${NAMES}export const order = { status: "paid", key: 1 }` },
        { filename: nodeFile, code: 'import { BOUNDS } from "../../vocabulary/bounds"\nexport const b = BOUNDS' },
        // The engine's control nodes key their hand-off and read the core effects (the exception of `controlNodeFiles`).
        {
            filename: controlFile,
            code: `${SDK}export const n = defineNode({ id: "core.call-workflow", run: (c) => c.effect("t", {}, { dedupeKey: "call-workflow:1" }) })`,
        },
        { filename: controlFile, code: "export const args = { onceKey: 'run-1' }" },
        { filename: controlSpec, code: 'import { coreEffects } from "../../vocabulary/effects"\nexport const e = coreEffects' },
    ],
    invalid: [
        { filename: nodeFile, code: `${SDK}export const t = defineTool({})`, errors: [{ messageId: "definition" }] },
        { filename: nodeFile, code: `${SDK}export const e = defineEffect({})`, errors: [{ messageId: "definition" }] },
        { filename: nodeFile, code: `${SDK}export const n = defineNode({})`, errors: [{ messageId: "definition" }] },
        {
            filename: nodeFile,
            code: `${NAMES}export const f = (p: string) => p === PROVIDER.sepay`,
            errors: [{ messageId: "provider" }],
        },
        {
            filename: nodeFile,
            code: `${NAMES}export const f = (p: string) => PROVIDER.casso !== p`,
            errors: [{ messageId: "provider" }],
        },
        {
            filename: nodeFile,
            code: `${NAMES}export const f = (p: string) => { switch (p) { case PROVIDER.sepay: return 1; default: return 0 } }`,
            errors: [{ messageId: "provider" }],
        },
        {
            filename: nodeFile,
            code: 'import { CRM_PROVIDER } from "../../vocabulary/crm-tool-names.generated"\nexport const f = (p: string) => p === CRM_PROVIDER',
            errors: [{ messageId: "provider" }],
        },
        {
            filename: nodeFile,
            code: "export const args = { dedupeKey: 'order-1' }",
            errors: [{ messageId: "ledgerKey" }],
        },
        {
            filename: nodeFile,
            code: "export const args = { onceKey: 'order-1' }",
            errors: [{ messageId: "ledgerKey" }],
        },
        {
            filename: nodeFile,
            code: 'import { ORDER } from "../../vocabulary/effects"\nexport const o = ORDER',
            errors: [{ messageId: "effects" }],
        },
        {
            filename: nodeFile,
            code: 'import { CRM } from "../../vocabulary/crm-effects"\nexport const o = CRM',
            errors: [{ messageId: "effects" }],
        },
        {
            filename: plainFile,
            code: `${NAMES}${TEMPLATE}export const n = defineTemplateNode({ run: (p: string) => p === PROVIDER.sepay })`,
            errors: [{ messageId: "provider" }],
        },
        // The control-node exception covers the ledger key and the effects import only: tools, effects and providers stay findings there.
        { filename: controlFile, code: `${SDK}export const t = defineTool({})`, errors: [{ messageId: "definition" }] },
        { filename: controlFile, code: `${SDK}export const e = defineEffect({})`, errors: [{ messageId: "definition" }] },
        {
            filename: controlFile,
            code: `${NAMES}export const f = (p: string) => p === PROVIDER.sepay`,
            errors: [{ messageId: "provider" }],
        },
        // A `nodes/core` folder of another package is no control node: its keys and effects imports stay findings.
        {
            filename: pluginControlLike,
            code: "export const args = { dedupeKey: 'order-1' }",
            errors: [{ messageId: "ledgerKey" }],
        },
        {
            filename: pluginControlLike,
            code: 'import { ORDER } from "../../vocabulary/effects"\nexport const o = ORDER',
            errors: [{ messageId: "effects" }],
        },
    ],
})
