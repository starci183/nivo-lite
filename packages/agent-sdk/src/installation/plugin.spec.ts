import { SdkDefinitionError } from "../block/definition-error"
import { lookTool, pingEffect } from "../tests/fixtures/probe-nodes"
import type { GraphSpec } from "../graph/graph-spec.types"
import type { WorkflowTemplate } from "../template/workflow-template"
import { defineInstallation, definePlugin } from "./installation"
import { moduleOf, nodeOf } from "./installation.fixture"
import { registryLinesOf } from "./registry-lines"

/** The error a call throws. */
function captured(call: () => unknown): unknown {
    try {
        call()
    } catch (error) {
        return error
    }
    return undefined
}

const LABEL = { vi: "Label (vi)", en: "Label" }

/** A graph with no node: this spec never reads a template's graph. */
const EMPTY_GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "",
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [], effects: [] },
    nodes: [],
}

/** A template with the given id and versions, whose graphs this spec never reads. */
const templateOf = (id: string, versions: ReadonlyArray<number>): WorkflowTemplate => ({
    id,
    moduleKey: id.split(".")[0] ?? "",
    primary: true,
    name: LABEL,
    summary: LABEL,
    requires: [],
    shops: 0,
    versions: versions.map((version) => ({
        version,
        publishedAt: "2026-11-11T00:00:00.000Z",
        changes: [LABEL],
        graph: EMPTY_GRAPH,
    })),
})

const core = definePlugin({
    key: "core",
    label: { vi: "Nivo", en: "Nivo" },
    modules: [moduleOf("sales")],
    nodes: [nodeOf("sales.consult")],
    effects: [pingEffect],
    tools: [lookTool],
    toolLabels: { [lookTool.id]: { kind: "reads", title: LABEL, summary: LABEL } },
    templates: [templateOf("sales.consult", [1, 2])],
    nodeModels: { "sales.consult": { model: "auto", weight: "light" } },
    messages: { sales: { vi: { a: "x" }, en: { a: "y" } } },
    guidance: (moduleKey, locale) => `${moduleKey}:${locale}`,
    words: (key) => (key === "t.core" ? "core words" : undefined),
})

const web = definePlugin({
    key: "web",
    packageName: "web-pkg",
    label: { vi: "Web", en: "Web" },
    visibility: "private",
    enterprises: ["nivo-web"],
    modules: [moduleOf("webdesk")],
    nodes: [nodeOf("webdesk.intake")],
    templates: [templateOf("webdesk.ticket", [1]), templateOf("webdesk.quote", [1])],
    guidance: (moduleKey) => `web words of ${moduleKey}`,
    words: (key) => (key === "t.web" ? "web words" : undefined),
})

describe("definePlugin and the installation as the array of plugins", () => {
    it("joins everything every plugin declares, in plugin order, and says which plugin brought which module", () => {
        const installed = defineInstallation([core, web], "h")
        expect(installed.plugins).toEqual([
            {
                key: "core",
                packageName: null,
                label: { vi: "Nivo", en: "Nivo" },
                visibility: "public",
                enterprises: [],
                modules: ["sales"],
                providers: [],
            },
            {
                key: "web",
                packageName: "web-pkg",
                label: { vi: "Web", en: "Web" },
                visibility: "private",
                enterprises: ["nivo-web"],
                modules: ["webdesk"],
                providers: [],
            },
        ])
        expect(installed.nodes.map((node) => node.id)).toEqual(["sales.consult", "webdesk.intake"])
        expect(installed.effects).toEqual([pingEffect])
        expect(installed.tools).toEqual([lookTool])
        expect(installed.templates.map((template) => template.id)).toEqual([
            "sales.consult",
            "webdesk.ticket",
            "webdesk.quote",
        ])
        expect(Object.keys(installed.toolLabels)).toEqual([lookTool.id])
        expect(installed.nodeModels).toEqual({ "sales.consult": { model: "auto", weight: "light" } })
        expect(installed.messages).toEqual({ sales: { vi: { a: "x" }, en: { a: "y" } } })
    })

    it("asks the plugin that declares a module for the words of its agent, and each plugin in order for a text key", () => {
        const installed = defineInstallation([core, web], "h")
        expect(installed.guidanceOf("sales", "vi")).toBe("sales:vi")
        expect(installed.guidanceOf("webdesk", "en")).toBe("web words of webdesk")
        expect(installed.guidanceOf("nobody", "vi")).toBe("")
        expect(installed.wordsOf("t.core")).toBe("core words")
        expect(installed.wordsOf("t.web")).toBe("web words")
        expect(installed.wordsOf("t.none")).toBeUndefined()
        expect(defineInstallation([{ modules: [moduleOf("crm")] }], "h").guidanceOf("crm", "vi")).toBe("")
    })

    it("holds nothing of a plugin that is not in the array", () => {
        const installed = defineInstallation([core], "h")
        expect(installed.plugins.map((plugin) => plugin.key)).toEqual(["core"])
        expect(installed.modules.map((module) => module.key)).toEqual(["sales"])
        expect(installed.templates.map((template) => template.id)).toEqual(["sales.consult"])
        expect(installed.guidanceOf("webdesk", "vi")).toBe("")
        expect(installed.wordsOf("t.web")).toBeUndefined()
    })

    it("refuses an id two plugins declare, naming the kind, the id and both owners", () => {
        const twin = (part: object): unknown => captured(() => defineInstallation([core, { ...web, ...part }], "h"))
        expect(twin({ modules: [moduleOf("sales")] })).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            params: { at: "module:sales (core, web)" },
        })
        expect(twin({ tools: [lookTool] })).toMatchObject({ params: { at: `tool:${lookTool.id} (core, web)` } })
        expect(twin({ effects: [pingEffect] })).toMatchObject({ params: { at: `effect:${pingEffect.id} (core, web)` } })
        expect(twin({ nodes: [nodeOf("sales.consult")] })).toMatchObject({ params: { at: "node:sales.consult (core, web)" } })
        expect(twin({ templates: [templateOf("sales.consult", [3])] })).toMatchObject({
            params: { at: "template:sales.consult (core, web)" },
        })
        expect(twin({ toolLabels: core.toolLabels })).toMatchObject({ params: { at: `tool-label:${lookTool.id} (core, web)` } })
        expect(twin({ nodeModels: core.nodeModels })).toMatchObject({ params: { at: "node-model:sales.consult (core, web)" } })
        expect(twin({ messages: core.messages })).toMatchObject({ params: { at: "messages:sales (core, web)" } })
        expect(twin({ key: "core" })).toMatchObject({ params: { at: "plugin:core" } })
        expect(twin({ key: "core" })).toBeInstanceOf(SdkDefinitionError)
    })

    it("refuses a version number a template declares twice", () => {
        expect(captured(() => definePlugin({ ...web, templates: [templateOf("webdesk.ticket", [1, 1])] }))).toMatchObject({
            code: "INSTALLATION_ID_DUPLICATE",
            params: { at: "template:webdesk.ticket@1" },
        })
    })

    it("refuses a private plugin that names no enterprise, a public one that names one, and a malformed key or identifier", () => {
        expect(captured(() => definePlugin({ ...web, enterprises: [] }))).toMatchObject({
            code: "PLUGIN_ACCESS_INVALID",
            params: { at: "plugin:web" },
        })
        expect(captured(() => definePlugin({ ...core, enterprises: ["nivo-web"] }))).toMatchObject({
            code: "PLUGIN_ACCESS_INVALID",
            params: { at: "plugin:core" },
        })
        expect(captured(() => definePlugin({ ...web, packageName: "@nivo-lite/web" }))).toMatchObject({
            code: "ID_MALFORMED",
            params: { at: "plugin:web:package:@nivo-lite/web" },
        })
        expect(captured(() => definePlugin({ ...web, enterprises: ["Nivo Web"] }))).toMatchObject({
            code: "ID_MALFORMED",
            params: { at: "plugin:web:Nivo Web" },
        })
        expect(captured(() => definePlugin({ ...web, key: "Web!" }))).toMatchObject({
            code: "ID_MALFORMED",
            params: { at: "plugin:Web!" },
        })
    })

    it("hashes the new keys: the lines of the parts equal the lines of the installation, and a change of any moves them", () => {
        const lines = registryLinesOf([core, web])
        expect(registryLinesOf([defineInstallation([core, web], "h")])).toEqual(lines)
        expect(lines).toEqual(
            expect.arrayContaining([
                "plugin:core:public:@0",
                "plugin:web:private:nivo-web@0",
                `effect:${pingEffect.id}@0`,
                `tool:${lookTool.id}@0`,
                `tool-label:${lookTool.id}@0`,
                "template:sales.consult@1",
                "template:sales.consult@2",
                "template:webdesk.quote@1",
                "node-model:sales.consult@0",
                "messages:sales@0",
            ]),
        )
        expect(registryLinesOf([core, { ...web, enterprises: ["other"] }])).not.toEqual(lines)
        expect(registryLinesOf([core, { ...web, templates: [] }])).not.toEqual(lines)
    })
})
