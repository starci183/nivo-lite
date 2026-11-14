import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { nodeIndexOf, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { MESSAGE_CATALOG, type MessageCatalog } from "@modules/platform/i18n"
import { FIXTURE_PLUGIN } from "@tests/fixtures/builders/fixture-plugin.builder"
import { AgentStepTitlesService } from "./agent-step-titles.service"

/** The nodes this app installs (the core package and every plugin), then the two nodes of the fixture plugin. */
const INSTALL = INSTALLED.nodeInstall()
const NODES: ReadonlyArray<NodeDefinition> = [...INSTALL.nodes, ...(FIXTURE_PLUGIN.nodes ?? [])]

/** Whether the plugin that declares the module of a step id (`<module>.<slug>`) is the core package. */
const isCoreStep = (id: string): boolean => INSTALLED.pluginOfModule(id.split(".")[0] ?? "")?.key === "core"

/** A step the installation declares: a `defineNode` control node or a template node (`defineTemplateNode`), each with its title. */
interface DeclaredStep {
    readonly id: string
    readonly title: SpecText
}

/** The title a definition declares, when it declares its words in both languages itself. */
const declaredOf = (node: DeclaredStep): { readonly vi: string; readonly en: string } | null =>
    "key" in node.title ? null : { vi: node.title.vi, en: node.title.en }

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, _params, locale) => `${locale}:${key}`)
    const registry = mock<GraphNodeRegistryService>({
        installed: jest.fn().mockReturnValue(nodeIndexOf({ ...INSTALL, nodes: NODES })),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentStepTitlesService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: GraphNodeRegistryService, useValue: registry },
        ],
    }).compile()
    return { titles: moduleRef.get(AgentStepTitlesService), catalog }
}

describe("AgentStepTitlesService", () => {
    it("titles a step of the core package with the words its node definition declares, never its id", async () => {
        const { titles } = await build()
        // The core package's steps since the flip: its control nodes and its template nodes (every business step is one).
        const core = [...INSTALL.nodes, ...INSTALLED.templateNodes()].filter(
            (node) => isCoreStep(node.id) && declaredOf(node) !== null,
        )

        expect(core.length).toBeGreaterThan(0)
        for (const node of core) {
            const title = titles.titleOf(node.id)
            expect(title).toEqual(declaredOf(node))
            expect([title?.vi, title?.en]).not.toContain(node.id)
        }
    })

    it("titles a step of a PLUGIN the same way: every installed node that is not the core package's", async () => {
        const { titles } = await build()
        // A plugin's steps since the flip are its template nodes; the installation's `defineNode` list holds the core control nodes only.
        const installed: ReadonlyArray<DeclaredStep> = [...INSTALL.nodes, ...INSTALLED.templateNodes()]
        const plugin = installed.filter((node) => !isCoreStep(node.id) && declaredOf(node) !== null)

        expect(plugin.length).toBeGreaterThan(0)
        for (const node of plugin) {
            expect(titles.titleOf(node.id)).toEqual(declaredOf(node))
        }
    })

    it("reads a title a plugin declares as a message key from the catalogue, once per language", async () => {
        const { titles, catalog } = await build()

        expect(titles.titleOf("fixdesk.intake")).toEqual({ vi: "vi:fixdeskIntake", en: "en:fixdeskIntake" })
        expect(catalog.get).toHaveBeenCalledWith("fixdeskIntake", {}, "vi")
        expect(catalog.get).toHaveBeenCalledWith("fixdeskIntake", {}, "en")
    })

    it("gives no title to a step no installed node is, rather than a word made from its id", async () => {
        const { titles } = await build()

        expect(titles.titleOf("webrenew.not-installed")).toBeNull()
        expect(titles.titleOf("stop")).toBeNull()
    })
})
