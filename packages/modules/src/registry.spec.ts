import { moduleListProblems } from "@nivo/agent-sdk/module"
import { REGISTERED_MODULE_KEYS } from "./index"
import { MODULE_SERVERS } from "./template"
import { MODULE_WORKBENCHES } from "./manifest"

describe("the module registry", () => {
    it("lists a server list the host may load", () => {
        expect(moduleListProblems(MODULE_SERVERS)).toEqual([])
    })

    it("lists the key of every server", () => {
        expect(REGISTERED_MODULE_KEYS).toEqual(["loyalty"])
    })

    it("gives every module with a workbench key one workbench declaration under that key", () => {
        const keys = MODULE_SERVERS.flatMap((module) =>
            module.template.workbench === null ? [] : [module.template.workbench],
        )
        expect(MODULE_WORKBENCHES.map((workbench) => workbench.key)).toEqual(keys)
    })
})
