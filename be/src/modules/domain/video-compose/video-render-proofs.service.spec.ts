import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionBindingsReadService, ConnectionsService } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WEBHOOK_PROOF_REGISTRY, type WebhookProofRegistry } from "@modules/platform/http-security"
import { FAKE_COMPOSE, FAKE_OUTPUT, FakeComposePort, composeAccountOf } from "@tests/fixtures/builders/video-compose.builder"
import { VideoComposeRegistryService } from "./video-compose-registry.service"
import { VideoRenderProofsService } from "./video-render-proofs.service"

const ACCOUNT = composeAccountOf()
const OWNER = { id: ACCOUNT.id, workspaceId: "ws-1", provider: FAKE_COMPOSE }
const body = (hook: Readonly<Record<string, unknown>>): Buffer => Buffer.from(JSON.stringify(hook))
const DONE = body({ id: "r-1", state: "succeeded", url: FAKE_OUTPUT })

describe("the render webhook proofs", () => {
    const proofsOf = async (port: FakeComposePort, provider: string = FAKE_COMPOSE) => {
        const registry = new VideoComposeRegistryService()
        registry.register(port)
        const added = mock<WebhookProofRegistry>()
        const bindings = mock<ConnectionBindingsReadService>()
        bindings.accountOf.mockResolvedValue({ ...OWNER, provider })
        const connections = mock<ConnectionsService>()
        connections.readSecret.mockResolvedValue({ plain: "cred", webhookSecret: "hook" })
        const moduleRef = await Test.createTestingModule({
            providers: [
                VideoRenderProofsService,
                { provide: WEBHOOK_PROOF_REGISTRY, useValue: added },
                { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager({}) },
                { provide: VideoComposeRegistryService, useValue: registry },
                { provide: ConnectionBindingsReadService, useValue: bindings },
                { provide: ConnectionsService, useValue: connections },
            ],
        }).compile()
        const proofs = moduleRef.get(VideoRenderProofsService)
        proofs.onApplicationBootstrap()
        return { added, proof: proofs.proofOf(port) }
    }
    const request = (signature: string | undefined) => ({ scope: ACCOUNT.id, rawBody: DONE, signature, timestamp: undefined })

    it("registers one proof per compose provider with a webhook, none for one without", async () => {
        expect((await proofsOf(new FakeComposePort())).added.add).toHaveBeenCalledTimes(1)
        expect((await proofsOf(new FakeComposePort(FAKE_COMPOSE, null))).added.add).not.toHaveBeenCalled()
    })

    it("proves the path's token against the connection's own webhook secret, and nothing for another provider's account", async () => {
        const { proof } = await proofsOf(new FakeComposePort())
        await expect(Promise.all([proof.prove(request("hook")), proof.prove(request("nope")), proof.prove(request(undefined))])).resolves.toEqual([
            true,
            false,
            false,
        ])
        await expect((await proofsOf(new FakeComposePort(), "veo")).proof.prove(request("hook"))).resolves.toBe(false)
    })
})
