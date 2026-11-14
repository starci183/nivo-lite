import { mock } from "@starci/jest-preset"
import type { ConnectionSecretReadsService } from "@modules/domain/connections"
import type { OpenApiReachAccount, OpenApiReachCall } from "@modules/domain/openapi-provider"
import { ToolsErrorCode } from "@modules/domain/tools"
import type { OpenApiClient, PublicHostClient } from "@modules/integrations/data-sources"
import { OpenApiLiveReachService } from "./openapi-live-reach.service"

const ACCOUNT: OpenApiReachAccount = { id: "conn-1", workspaceId: "ws-1", provider: "openapi", sandbox: false, connector: "crm.sample" }
const BASE = { baseUrl: "https://api.sample.vn", authType: "bearer" as const, authName: "" }
const CALL: OpenApiReachCall = {
    baseUrl: BASE.baseUrl,
    operationId: "getThing",
    method: "GET",
    path: "/things/{id}",
    params: [],
    hasBody: false,
    input: { id: "T-1" },
    key: { type: "bearer", name: "", value: "k" },
    maxBytes: 1000,
}

const setup = () => {
    const secrets = mock<ConnectionSecretReadsService>()
    const client = mock<OpenApiClient>()
    const host = mock<PublicHostClient>()
    host.allowsPrivate.mockReturnValue(false)
    host.resolve.mockResolvedValue({ address: "93.184.216.34" } as Awaited<ReturnType<PublicHostClient["resolve"]>>)
    return { secrets, client, host, reach: new OpenApiLiveReachService(secrets, client, host) }
}

describe("OpenApiLiveReachService", () => {
    it("hands the planned call to the client with the opened key and answers its status and text", async () => {
        const { client, reach } = setup()
        client.call.mockResolvedValue({ status: 200, headers: {}, text: "{\"id\":\"T-1\"}" })
        await expect(reach.call(ACCOUNT, CALL)).resolves.toEqual({ status: 200, text: "{\"id\":\"T-1\"}" })
        expect(client.call).toHaveBeenCalledWith(
            expect.objectContaining({
                baseUrl: BASE.baseUrl,
                op: expect.objectContaining({ id: "getThing", method: "GET", path: "/things/{id}" }),
                auth: expect.objectContaining({ type: "bearer", value: "k" }),
                input: { id: "T-1" },
            }),
        )
    })

    it("opens the key of the account only when it is the workspace's own", async () => {
        const { secrets, reach } = setup()
        secrets.secretOf.mockResolvedValue({ kind: "ok", value: { workspaceId: "ws-1", credential: JSON.stringify({ value: "k" }) } } as Awaited<
            ReturnType<ConnectionSecretReadsService["secretOf"]>
        >)
        await expect(reach.keyOf(ACCOUNT, BASE)).resolves.toEqual({ type: "bearer", name: "", value: "k" })
        secrets.secretOf.mockResolvedValue({ kind: "ok", value: { workspaceId: "ws-2", credential: JSON.stringify({ value: "k" }) } } as Awaited<
            ReturnType<ConnectionSecretReadsService["secretOf"]>
        >)
        await expect(reach.keyOf(ACCOUNT, BASE)).resolves.toBeNull()
    })

    it("refuses a host that resolves to a private address", async () => {
        const { host, reach } = setup()
        host.resolve.mockResolvedValue({ address: "10.0.0.5" } as Awaited<ReturnType<PublicHostClient["resolve"]>>)
        await expect(reach.reachable(ACCOUNT, BASE)).rejects.toMatchObject({ code: ToolsErrorCode.NativeRefused })
    })

    it("answers null for a live document the system does not hand", async () => {
        const { client, reach } = setup()
        client.fetchSpec.mockRejectedValue(new Error("down"))
        await expect(reach.liveDocument(ACCOUNT, "https://api.sample.vn/openapi.json")).resolves.toBeNull()
    })

    it("refuses every call in an app without a client", async () => {
        const reach = new OpenApiLiveReachService()
        expect(reach.serves()).toBe(false)
        await expect(reach.call(ACCOUNT, CALL)).rejects.toMatchObject({ code: ToolsErrorCode.NativeRefused })
    })
})
