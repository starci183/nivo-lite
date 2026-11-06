import { portsOf } from "@nivo-lite/agent-sdk/port"
import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { INSTALLATION, INSTALLATION_FACTS } from "../fixtures/platform.fixtures"
import { installationPort } from "../ports"
import type { InstallationSource } from "../platform.types"
import { installationRead } from "./installation.read"

const CONTEXT = {
    workspaceId: "ws-1",
    memberId: "member-1",
    now: new Date("2026-11-05T01:00:00.000Z"),
    timeZone: "Asia/Ho_Chi_Minh",
}

const providerOf = (source: InstallationSource): PortProvider => ({
    implementationOf: (port) => (port.id === installationPort.id ? source : undefined),
})

describe("platform.installation", () => {
    it("answers the registry hash and every module, enabled as the source says", async () => {
        const source: InstallationSource = {
            current: () => Promise.resolve(INSTALLATION_FACTS),
        }

        const result = await installationRead.execute?.(providerOf(source), {}, CONTEXT)

        expect(result).toEqual({ ok: true, data: INSTALLATION })
    })

    it("refuses a variable the read does not declare", async () => {
        const source: InstallationSource = { current: () => Promise.reject(new Error("unreached")) }

        const result = await installationRead.execute?.(providerOf(source), { extra: 1 }, CONTEXT)

        expect(result).toMatchObject({ ok: false })
    })

    it("reaches the source through its one port", () => {
        const source: InstallationSource = { current: () => Promise.reject(new Error("unreached")) }

        expect(portsOf(providerOf(source), installationRead.ports ?? {})).toEqual({ installation: source })
    })
})
