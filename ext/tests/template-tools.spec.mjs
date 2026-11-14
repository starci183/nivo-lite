// The decisions of the project check `template-tools` (ext/support/template-tools-rules.mjs) on fixtures.
import { strict as assert } from "node:assert"
import { test } from "node:test"
import { countsByPlugin, defaultToolFindings, findingLines, listsOfPlugin } from "../support/template-tools-rules.mjs"

const SETS = { aiReadTools: ["nivo.tool.brain.search", "nivo.tool.contact.get", "nivo.tool.conversation.message.list"], nodeTools: ["nivo.tool.record.get", "nivo.tool.record.update", "nivo.tool.timer.arm"] }
const node = (extra) => ({ plugin: "core", module: "sales", name: "sales.x", tools: [], ...extra })

test("a node that lists only outside tools: no finding", () => {
    assert.deepEqual(defaultToolFindings([node({ tools: ["nivo.tool.customer.message.send", "nivo.tool.team.message.post"] })], SETS), [])
})

test("a record, file or timer tool is never listed, even when the node's code calls it", () => {
    const found = defaultToolFindings([node({ tools: ["nivo.tool.record.get", "nivo.tool.timer.arm", "nivo.tool.customer.message.send"], codeCalls: ["nivo.tool.record.get", "nivo.tool.timer.arm"] })], SETS)
    assert.deepEqual(found.map((one) => [one.tool, one.set]), [["nivo.tool.record.get", "node-default"], ["nivo.tool.timer.arm", "node-default"]])
})

test("an AI read is a finding when only the node's AI step uses it", () => {
    const found = defaultToolFindings([node({ tools: ["nivo.tool.brain.search", "nivo.tool.customer.message.send"], codeCalls: ["nivo.tool.customer.message.send"] })], SETS)
    assert.deepEqual(found.map((one) => [one.tool, one.set]), [["nivo.tool.brain.search", "ai-read"]])
})

test("an AI read the node's own code calls, or the node requires, stays listed", () => {
    assert.deepEqual(defaultToolFindings([node({ tools: ["nivo.tool.contact.get", "nivo.tool.conversation.message.list"], codeCalls: ["nivo.tool.contact.get"], requires: ["nivo.tool.conversation.message.list"] })], SETS), [])
})

test("a module agent's set never lists a default, whatever a node's code calls", () => {
    const found = defaultToolFindings([node({ name: "agent", tools: ["nivo.tool.contact.get", "nivo.tool.record.update", "nivo.tool.customer.message.send"], codeCalls: ["nivo.tool.contact.get"] })], SETS)
    assert.deepEqual(found.map((one) => one.tool), ["nivo.tool.contact.get", "nivo.tool.record.update"])
})

test("a tool listed twice is one finding", () => {
    assert.equal(defaultToolFindings([node({ tools: ["nivo.tool.brain.search", "nivo.tool.brain.search"] })], SETS).length, 1)
})

test("findings print as plugin, module, agent or node, tool, in a fixed order", () => {
    const found = defaultToolFindings(
        [node({ module: "chatbot", name: "chatbot.answer", tools: ["nivo.tool.brain.search"] }), node({ plugin: "web", module: "webdesk", name: "agent", tools: ["nivo.tool.record.get"] })],
        SETS,
    )
    assert.deepEqual(findingLines(found), ["  core  chatbot  chatbot.answer  nivo.tool.brain.search", "  web  webdesk  agent  nivo.tool.record.get"])
    assert.equal(countsByPlugin(found), "core 1, web 1")
})

test("the lists of a plugin: module agent sets, placed nodes once per agent, code calls from the examples", () => {
    const placed = { id: "sales.tell", tools: ["nivo.tool.customer.message.send"], requires: [], examples: [{ tools: [{ id: "nivo.tool.contact.get" }] }, {}] }
    const plugin = {
        key: "core",
        modules: [{ key: "sales", agent: { tools: ["nivo.tool.customer.message.send"] } }, { key: "platform" }],
        templateAgents: [{ key: "sales", graphs: [{ nodes: new Map([["sales.tell", placed]]) }, { nodes: new Map([["sales.tell", placed]]) }] }],
        templateNodes: [placed, { id: "sales.loose", tools: ["nivo.tool.brain.search"] }],
        nodes: [{ id: "core.if" }],
    }
    const lists = listsOfPlugin(plugin)
    assert.deepEqual(lists.map((list) => `${list.module}/${list.name}`), ["sales/agent", "sales/sales.tell", "-/sales.loose"])
    assert.deepEqual(lists[1].codeCalls, ["nivo.tool.contact.get"])
})
