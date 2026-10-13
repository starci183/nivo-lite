import { EnvSource } from "@modules/platform/config"
import { parseWorkspacesConfig } from "./workspaces.config"

describe("parseWorkspacesConfig", () => {
    it("turns free signup on when the environment says so", () => {
        expect(parseWorkspacesConfig(new EnvSource({ WORKSPACE_SIGNUP_ENABLED: "true" }))).toEqual({
            allowFreeWorkspace: true,
        })
    })

    it("keeps free signup off when the key is absent", () => {
        expect(parseWorkspacesConfig(new EnvSource({}))).toEqual({ allowFreeWorkspace: false })
    })

    it("keeps free signup off when the environment says false", () => {
        expect(parseWorkspacesConfig(new EnvSource({ WORKSPACE_SIGNUP_ENABLED: "false" }))).toEqual({
            allowFreeWorkspace: false,
        })
    })
})
