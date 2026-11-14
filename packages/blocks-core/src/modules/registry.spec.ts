import { moduleListProblems, seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../blocks/core-blocks"
import { workbenchSpecProblems } from "./workbench-spec-problems"
import { MODULE_DECLARATIONS } from "./module-declarations"
import { MODULE_FIXTURES } from "./module-fixtures"
import { MODULE_MESSAGES } from "./module-messages"
import { MODULE_SERVERS } from "./module-servers"
import { REGISTERED_MODULE_KEYS } from "./registered-module-keys"

describe("the module registry", () => {
    it("lists a server list the host may load", () => {
        expect(moduleListProblems(MODULE_SERVERS)).toEqual([])
    })

    it("lists the key of every server", () => {
        expect(REGISTERED_MODULE_KEYS).toEqual([
            "chatbot",
            "lead_gen",
            "sales",
            "booking",
            "video",
            "content",
            "hiring",
        ])
    })
})

describe("MODULE_DECLARATIONS", () => {
    it("holds declarations whose seed specs draw with the core blocks and their own reads and actions", () => {
        expect(
            MODULE_DECLARATIONS.flatMap((declaration) =>
                seedSpecProblems(declaration, coreBlocks, MODULE_DECLARATIONS),
            ),
        ).toEqual([])
    })

    it("opens every agent's workbench on its desk and keeps raw records on data pages (the workbench rule)", () => {
        expect(
            MODULE_DECLARATIONS.flatMap((declaration) =>
                workbenchSpecProblems(declaration, coreBlocks, MODULE_DECLARATIONS).map((problem) => ({
                    module: declaration.key,
                    ...problem,
                })),
            ),
        ).toEqual([])
    })

    it("holds each module key once", () => {
        const keys = MODULE_DECLARATIONS.map((declaration) => declaration.key)
        expect(new Set(keys).size).toBe(keys.length)
    })
})

describe("MODULE_FIXTURES", () => {
    it("holds fixtures only for declared modules, their reads and their actions", () => {
        const strays = Object.entries(MODULE_FIXTURES).flatMap(([key, fixtures]) => {
            const declaration = MODULE_DECLARATIONS.find((candidate) => candidate.key === key)
            if (declaration === undefined) return [key]
            const reads = new Set<string>(declaration.reads.map((read) => read.id))
            const actions = new Set<string>(declaration.actions.map((action) => action.id))
            return [
                ...Object.keys(fixtures.reads).filter((id) => !reads.has(id)),
                ...Object.keys(fixtures.actions).filter((id) => !actions.has(id)),
            ]
        })
        expect(strays).toEqual([])
    })

    it("holds a fixture for every read and every action of every declared module", () => {
        const missing = MODULE_DECLARATIONS.flatMap((declaration) => {
            const fixtures = MODULE_FIXTURES[declaration.key]
            return [
                ...declaration.reads.filter((read) => fixtures?.reads[read.id] === undefined).map((read) => read.id),
                ...declaration.actions.filter((action) => fixtures?.actions[action.id] === undefined).map((a) => a.id),
            ]
        })
        expect(missing).toEqual([])
    })
})

describe("MODULE_MESSAGES", () => {
    it("holds the same keys in both languages for every declared module", () => {
        for (const declaration of MODULE_DECLARATIONS) {
            const messages = MODULE_MESSAGES[declaration.namespace]
            expect(messages).toBeDefined()
            expect(Object.keys(messages?.en ?? {}).sort()).toEqual(Object.keys(messages?.vi ?? {}).sort())
        }
    })
})
