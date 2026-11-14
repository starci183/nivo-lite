import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { J2V_KEY } from "../../../tests/fixtures/builders/json2video.builder"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { Json2VideoCredentialService, json2videoKeyOf } from "./json2video-credential.service"

const account = (provider: ConnectionRecord["provider"]): ConnectionRecord => connectionRecord({ id: "conn-j", workspaceId: "ws-1", provider, name: "J", meta: {} })

describe("json2videoKeyOf", () => {
    it.each([
        [JSON.stringify({ apiKey: ` ${J2V_KEY} ` }), J2V_KEY],
        [JSON.stringify({ apiKey: "" }), null],
        [JSON.stringify({ other: "x" }), null],
        ["not json", null],
        ["[]", null],
    ])("reads %s as %s", (plain, expected) => {
        expect(json2videoKeyOf(plain)).toBe(expected)
    })
})

describe("Json2VideoCredentialService > keyOf", () => {
    const build = (plain: string) => {
        const connections = mock<ConnectionsService>()
        connections.readSecret.mockResolvedValue({ plain, webhookSecret: "h" })
        return { service: new Json2VideoCredentialService(connections), connections }
    }

    it("opens the key of a json2video account", async () => {
        await expect(build(JSON.stringify({ apiKey: J2V_KEY })).service.keyOf(account("json2video"))).resolves.toBe(J2V_KEY)
    })

    it("refuses no_credential, proved not_sent, for an account with no key and reads no secret of another provider's account", async () => {
        const empty = build("{}")
        const thrown = await empty.service.keyOf(account("json2video")).then(() => undefined, (cause: unknown) => cause)
        expect(thrown).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(proofOf(thrown)).toBe("not_sent")

        const foreign = build(JSON.stringify({ apiKey: J2V_KEY }))
        await expect(foreign.service.keyOf(account("shotstack"))).rejects.toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(foreign.connections.readSecret).not.toHaveBeenCalled()
    })
})
