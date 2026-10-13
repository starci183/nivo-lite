import { EnvSource } from "@modules/platform/config"
import { parsePlatformAdminConfig } from "./platform-admin.config"

describe("parsePlatformAdminConfig", () => {
    it("reads nobody when the admin list is absent", () => {
        expect(parsePlatformAdminConfig(new EnvSource({}))).toEqual({ admins: [] })
    })

    it("lower-cases and trims the comma list, dropping blank entries", () => {
        expect(parsePlatformAdminConfig(new EnvSource({ NIVO_PLATFORM_ADMINS: "  Mai@X.vn , ,LAN@x.vn,  " }))).toEqual({
            admins: ["mai@x.vn", "lan@x.vn"],
        })
    })
})
