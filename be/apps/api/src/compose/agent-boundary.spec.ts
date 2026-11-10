import { coreEffects, coreNodes, coreTools } from "@nivo-lite/blocks-core"
import { MODULE_DECLARATIONS } from "@nivo-lite/blocks-core/modules"

/**
 * AGENT BOUNDARY, the catalogue half: what exists for an engine agent to call at all. The runner refuses anything a step does not
 * declare (`packages/agent-sdk/src/node/agent-boundary.spec.ts`); this spec holds what CAN be declared in this app: every effect
 * and tool the app installs is a business tool of NIVO (`<domain>.<object>.<verb>`), every tool a module gives its agent is one of
 * them, and none is a shell, a file or a web tool. Text a customer writes reaches a model, so a tool that runs a command, reads a
 * path or fetches an address must not exist for it.
 */

const installed: ReadonlyArray<string> = [...coreEffects.map((effect) => effect.id), ...coreTools.map((tool) => tool.id)]

/** A word of a tool id that would name the machine or the open network instead of the shop's business. */
const FORBIDDEN = /(^|[.\-_])(shell|bash|sh|exec|execute|command|cmd|process|spawn|eval|script|file|files|fs|path|disk|http|https|url|web|fetch|browse|browser|curl|request|socket|sql|query)([.\-_]|$)/u

describe("agent boundary: the tools that exist for an engine agent", () => {
    it("installs business tools only: no shell, file or web tool exists to declare", () => {
        expect(installed.length).toBeGreaterThan(0)
        expect(installed.filter((id) => FORBIDDEN.test(id))).toEqual([])
    })

    it("names every installed effect and tool as a business call, lower-case words joined by dots", () => {
        expect(installed.filter((id) => !/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/u.test(id))).toEqual([])
        expect(new Set(installed).size).toBe(installed.length)
    })

    it("gives each module's agent only tools the app installs", () => {
        const known = new Set<string>(installed)
        const unknown = MODULE_DECLARATIONS.flatMap((module) =>
            (module.agent?.tools ?? []).filter((id) => !known.has(id)).map((id) => `${module.key}: ${id}`),
        )

        expect(unknown).toEqual([])
    })

    it("lets every installed step declare only effects and tools the app installs", () => {
        const known = new Set<string>(installed)
        const unknown = coreNodes.flatMap((node) =>
            [...node.effects, ...(node.tools ?? [])].filter((id) => !known.has(id)).map((id) => `${node.id}: ${id}`),
        )

        expect(unknown).toEqual([])
    })
})
