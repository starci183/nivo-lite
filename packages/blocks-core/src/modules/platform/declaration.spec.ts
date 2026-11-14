import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../blocks/core-blocks"
import { platformModule } from "./declaration"
import { installationRead } from "./reads/installation.read"

describe("platform module", () => {
    it("declares the installation, the agent reads, the parked runs and the work desk reads behind the view permission, the resume and decide actions and one screen: the runs of an agent", () => {
        expect(platformModule.key).toBe("platform")
        expect(platformModule.permissions).toEqual(["platform.view"])
        expect(platformModule.reads.map((read) => read.id)).toEqual([
            "platform.installation",
            "platform.agent-done",
            "platform.agent-connections",
            "platform.agent-knowledge",
            "platform.installation-connections",
            "platform.installation-knowledge",
            "platform.parked-runs",
            "platform.agent-runs",
            "platform.agent-run-counts",
            "platform.agent-run",
            "platform.agent-flows",
            "platform.waiting-on-person",
            "platform.agent-today",
            "platform.agent-reach",
        ])
        expect(platformModule.actions.map((action) => action.id)).toEqual([
            "platform.resume-run",
            "platform.approval-decide",
        ])
        expect(platformModule.specs.map((spec) => spec.views.map((view) => view.id))).toEqual([["runs"]])
        expect(seedSpecProblems(platformModule, coreBlocks)).toEqual([])
    })

    it("gives the read the installation port and no variable", () => {
        expect(Object.values(installationRead.ports ?? {}).map((port) => port.id)).toEqual(["platform.installation"])
        expect(installationRead.shape).toBe("record")
    })
})
