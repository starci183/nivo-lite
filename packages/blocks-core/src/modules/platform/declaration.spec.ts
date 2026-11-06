import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { coreBlocks } from "../../blocks/core-blocks"
import { platformModule } from "./declaration"
import { installationRead } from "./reads/installation.read"

describe("platform module", () => {
    it("declares the installation, the three agent reads and the parked runs behind one permission, the resume action and no screen", () => {
        expect(platformModule.key).toBe("platform")
        expect(platformModule.permissions).toEqual(["platform.view"])
        expect(platformModule.reads.map((read) => read.id)).toEqual([
            "platform.installation",
            "platform.agent-done",
            "platform.agent-connections",
            "platform.agent-knowledge",
            "platform.parked-runs",
        ])
        expect(platformModule.actions.map((action) => action.id)).toEqual(["platform.resume-run"])
        expect(platformModule.specs).toEqual([])
        expect(seedSpecProblems(platformModule, coreBlocks)).toEqual([])
    })

    it("gives the read the installation port and no variable", () => {
        expect(Object.values(installationRead.ports ?? {}).map((port) => port.id)).toEqual(["platform.installation"])
        expect(installationRead.shape).toBe("record")
    })
})
