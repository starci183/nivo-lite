import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { declarationProblems } from "@modules/domain/connection-fields"
import { ConnectionsService } from "@modules/domain/connections"
import { seededRecordOf } from "@tests/fixtures/builders/channel-connections.builder"
import { ZaloConnectService } from "./zalo-connect.service"
import { ZaloConnectionFieldsService } from "./zalo-connection-fields.service"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const OA = seededRecordOf("c-1", "zalo_oa", { oa_name: "Shop", oa_id: "42", oa_secret_saved: "true" })

const build = async () => {
    const zalo = mock<ZaloConnectService>()
    const connections = mock<ConnectionsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ZaloConnectionFieldsService,
            { provide: ZaloConnectService, useValue: zalo },
            { provide: ConnectionsService, useValue: connections },
        ],
    }).compile()
    return { writer: moduleRef.get(ZaloConnectionFieldsService), zalo, connections }
}

describe("ZaloConnectionFieldsService", () => {
    it("declares the OA name, id and app id as shown, the webhook address to copy, and the OA Secret Key as write-only, sealed by the connect step's flag", async () => {
        const { writer } = await build()
        const [form] = writer.declarations

        expect(form).toMatchObject({ provider: "zalo_oa", editableBy: ["owner"], canTest: true })
        expect(form?.fields.map((field) => [field.key, field.kind, field.sealedBy ?? null])).toEqual([
            ["oaName", "identity", null],
            ["oaId", "identity", null],
            ["appId", "identity", null],
            ["webhookUrl", "identity", null],
            ["oaSecret", "secret", { kind: "meta-flag", key: "oa_secret_saved" }],
        ])
    })

    it("seals a new key through the connect step and renames through the connections capability", async () => {
        const { writer, zalo, connections } = await build()

        await writer.write(ACTOR, OA, { displayName: "Shop OA", values: { oaSecret: "s".repeat(20) } })
        await writer.write(ACTOR, OA, { displayName: null, values: {} })

        expect(zalo.saveOaSecret.mock.calls).toEqual([[ACTOR, "c-1", "s".repeat(20)]])
        expect(connections.rename.mock.calls).toEqual([[ACTOR, "c-1", "Shop OA"]])
    })
})

describe("the secret check of the Zalo OA form", () => {
    it("registers: no secret has a readable source and no action answers a secret", async () => {
        const { writer } = await build()

        expect(writer.declarations.flatMap((declaration) => declarationProblems(declaration))).toEqual([])
    })
})
