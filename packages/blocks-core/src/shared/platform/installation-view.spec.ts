import { INSTALLATION, INSTALLATION_FACTS, INSTALLATION_NONE } from "./fixtures/platform.fixtures"
import { installationViewOf } from "./installation-view"

describe("installationViewOf", () => {
    it("marks a module enabled when the workspace has it, keeping the registry order and hash", () => {
        expect(installationViewOf(INSTALLATION_FACTS)).toEqual(INSTALLATION)
    })

    it("lists no module for a registry that holds none", () => {
        expect(
            installationViewOf({ registryHash: INSTALLATION.registryHash, modules: [], enabled: ["sales"] }),
        ).toEqual(INSTALLATION_NONE)
    })
})
