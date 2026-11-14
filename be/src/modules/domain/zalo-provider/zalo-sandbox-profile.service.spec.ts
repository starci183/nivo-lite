import { readFileSync } from "node:fs"
import { ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { ZaloSandboxProfileService } from "./zalo-sandbox-profile.service"

const ACCOUNT = sandboxAccount({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa" })
const CONNECTION = connectionRecord({ id: "conn-z", workspaceId: "ws-1", provider: "zalo_oa", sandbox: true })

const setup = () => {
    const { sandbox } = sandboxServiceOf(ACCOUNT)
    return { sandbox, service: new ZaloSandboxProfileService(sandbox) }
}

describe("ZaloSandboxProfileService", () => {
    it("ZALO-4: answers the catalogue customer's name and picture", async () => {
        const { service } = setup()

        expect(await service.profileOf("conn-z", "8800110022")).toEqual({
            name: "Nguyen Van An",
            picture: "https://s75-ava-talk.zadn.vn/sandbox/an.jpg",
        })
    })

    it("ZALO-4: answers null for a person the OA does not know, never a failure", async () => {
        const { service } = setup()

        expect(await service.profileOf("conn-z", "1234567890")).toBeNull()
    })

    it("ZALO-5 (the account's next case): the logged read answers null even for a known customer, until ZALO-4 is picked again", async () => {
        const { sandbox, service } = setup()

        await sandbox.setNextCase(ACCOUNT, "profileOf", "ZALO-5")
        expect(await service.profileOfAccount(CONNECTION, "8800110022")).toBeNull()
        await sandbox.setNextCase(ACCOUNT, "profileOf", "ZALO-4")
        expect(await service.profileOfAccount(CONNECTION, "8800110022")).toMatchObject({ name: "Nguyen Van An" })
    })

    it("answers the same through the account form and logs exactly one call per request", async () => {
        const { sandbox, service } = setup()

        expect(await service.profileOfAccount(CONNECTION, "8800110033")).toEqual(await service.profileOf("conn-z", "8800110033"))
        expect(await service.profileOfAccount(CONNECTION, "1234567890")).toBeNull()
        const calls = await sandbox.calls(ACCOUNT, "profileOf")
        expect(calls).toHaveLength(2)
        expect(calls[0]).toMatchObject({ key: "8800110033", request: { personId: "8800110033" } })
    })

    it("refuses a live account and a switched-off sandbox through the account form", async () => {
        const { service } = setup()
        const off = new ZaloSandboxProfileService(sandboxServiceOff(ACCOUNT).sandbox)

        await expect(service.profileOfAccount({ ...CONNECTION, sandbox: false }, "8800110022")).rejects.toMatchObject({
            code: ProviderSandboxErrorCode.LiveAccount,
        })
        await expect(off.profileOfAccount(CONNECTION, "8800110022")).rejects.toMatchObject({ code: ProviderSandboxErrorCode.Off })
    })

    it("has zero network: one dependency, no integration import, no http", () => {
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")

        expect(ZaloSandboxProfileService.length).toBe(1)
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
