import { INSTALLED } from "@modules/domain/installed-plugins"
import { TOOL_SPECS } from "@modules/domain/tool-specs"

/**
 * AGENT BOUNDARY, the catalogue half: what exists for an engine agent to call at all. The runner refuses anything a step does not
 * declare (`packages/agent-sdk/src/node/agent-boundary.spec.ts`); this spec holds what CAN be declared in this app: every effect
 * and tool the app installs is a business tool of NIVO (`<domain>.<object>.<verb>`), every tool a module gives its agent is one of
 * them, and none is a shell, a file or a web tool. Text a customer writes reaches a model, so a tool that runs a command, reads a
 * path or fetches an address must not exist for it.
 */

const INSTALL = INSTALLED.nodeInstall()
const installed: ReadonlyArray<string> = [...INSTALL.effects.map((effect) => effect.id), ...INSTALL.tools.map((tool) => tool.id)]

/**
 * Every id a step or an agent can reach: the installed effects and tools, and the back end's own core tools (`TOOL_SPECS`). Since the
 * flip a template node's call of an id that is no installed effect goes on the tool road (`graph-node-host.service.ts`, `calledOnce`),
 * which the back end's tool registry serves: a read such as `nivo.tool.lead.care.get` has no package definition and is still installed.
 */
const reachable: ReadonlyArray<string> = [...new Set([...installed, ...Object.keys(TOOL_SPECS)])]

/**
 * The record file store's tools (`nivo.tool.file.{put,link,get}`, concept `files`): a file here is the field of a record the calling
 * agent owns, stored in the engine's own bucket, so they name no path of the machine and open no address of the network.
 */
const RECORD_FILE_TOOLS: ReadonlySet<string> = new Set(["nivo.tool.file.put", "nivo.tool.file.link", "nivo.tool.file.get"])

/** A word of a tool id that would name the machine or the open network instead of the shop's business. */
const FORBIDDEN = /(^|[.\-_])(shell|bash|sh|exec|execute|command|cmd|process|spawn|eval|script|file|files|fs|path|disk|http|https|url|web|fetch|browse|browser|curl|request|socket|sql|query)([.\-_]|$)/u

describe("agent boundary: the tools that exist for an engine agent", () => {
    it("installs business tools only: no shell, file or web tool exists to declare", () => {
        expect(installed.length).toBeGreaterThan(0)
        expect(reachable.filter((id) => !RECORD_FILE_TOOLS.has(id) && FORBIDDEN.test(id))).toEqual([])
    })

    it("names every installed effect and tool as a business call, lower-case words joined by dots", () => {
        expect(reachable.filter((id) => !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/u.test(id))).toEqual([])
        expect(new Set(installed).size).toBe(installed.length)
    })

    it("gives each module's agent only tools the app installs", () => {
        const known = new Set<string>(reachable)
        const unknown = INSTALLED.plugins.flatMap((plugin) => plugin.modules).flatMap((key) => INSTALLED.moduleOf(key) ?? []).flatMap((module) =>
            (module.agent?.tools ?? []).filter((id) => !known.has(id)).map((id) => `${module.key}: ${id}`),
        )

        expect(unknown).toEqual([])
    })

    it("lets every installed step declare only effects and tools the app installs", () => {
        const known = new Set<string>(reachable)
        // The core package's steps since the flip: its control nodes (effects and tools) and its template nodes (every call a tool call).
        const declared = [
            ...INSTALL.nodes.map((node) => ({ id: node.id, calls: [...node.effects, ...(node.tools ?? [])] })),
            ...INSTALLED.templateNodes().map((node) => ({ id: node.id, calls: [...node.tools] })),
        ]
        const unknown = declared.flatMap((node) =>
            node.calls.filter((id) => !known.has(id)).map((id) => `${node.id}: ${id}`),
        )

        expect(unknown).toEqual([])
    })
})
