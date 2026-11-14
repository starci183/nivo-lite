import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { ToolsErrorCode, type NativeCaller } from "@modules/domain/tools"
import {
    FAKE_COMPOSE,
    FAKE_SIGNED,
    FAKE_UNSIGNED,
    FakeComposePort,
    SOUND_SPEC,
    composeAccountOf,
} from "@tests/fixtures/builders/video-compose.builder"
import type { ComposeSpec, OptionalRenderWebhook } from "./video-compose.contracts"
import { VideoComposeRegistryService } from "./video-compose-registry.service"
import {
    VIDEO_COMPOSE_BUSINESS_REFUSALS,
    VIDEO_COMPOSE_REFUSAL_CLASS,
    VIDEO_RENDER_GET_BUSINESS_REFUSALS,
} from "./video-compose-refusal.policy"
import { causeFactsOf, causeParamsOf } from "@tests/fixtures/builders/cause-facts.builder"
import { COMPOSE_SPEC_SCHEMA } from "./video-compose.schema"
import { VIDEO_COMPOSE_MANIFEST, VIDEO_COMPOSE_TOOL, VideoComposeNativeService } from "./video-compose.service"

const ORIGIN = "https://api.nivo.test"
const HOOK_SECRET = "hook-secret"
const ACCOUNT = composeAccountOf()

const caller = (connectionId?: string): NativeCaller =>
    ({ agentId: "agent-1", conversationId: null, ...(connectionId === undefined ? {} : { connectionId }) })

const build = async (
    options: {
        readonly found?: ConnectionRecord | null
        readonly webhook?: OptionalRenderWebhook
        readonly origin?: string | null
        readonly port?: FakeComposePort
    } = {},
) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(options.found === undefined ? ACCOUNT : options.found)
    connections.publicOrigin.mockReturnValue(options.origin === undefined ? ORIGIN : options.origin)
    connections.readSecret.mockResolvedValue({ plain: "{}", webhookSecret: HOOK_SECRET })
    const port = options.port ?? new FakeComposePort(FAKE_COMPOSE, options.webhook === undefined ? FAKE_UNSIGNED : options.webhook)
    const registry = new VideoComposeRegistryService()
    registry.register(port)
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoComposeNativeService,
            { provide: ConnectionsService, useValue: connections },
            { provide: VideoComposeRegistryService, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(VideoComposeNativeService), port, connections }
}

/** The params of the error a call threw (a refusal's `reason` and `refusalClass`), or the code of another error. */
const thrownOf = (work: Promise<unknown>): Promise<Readonly<Record<string, unknown>>> =>
    work.then(
        () => ({}),
        (cause: unknown) => {
            return { code: causeFactsOf(cause).code, ...causeParamsOf(cause) }
        },
    )

/** One compose call; `null` hands no account. */
const compose = (service: VideoComposeNativeService, spec: unknown, connectionId: string | null = ACCOUNT.id) =>
    service.invoke("ws-1", VIDEO_COMPOSE_TOOL.compose, { spec }, caller(connectionId ?? undefined))

describe("the compose manifest", () => {
    it("names both tools by their generic purpose under nivo.tool, internal only; the compose write asks first, the read never", () => {
        expect(VIDEO_COMPOSE_MANIFEST.tools.map((tool) => [tool.domain, tool.scope, tool.defaultMode, tool.internalOnly])).toEqual([
            ["nivo.tool.video.compose", "write", "ask", true],
            ["nivo.tool.video.render.get", "read", "auto", true],
        ])
        expect(VIDEO_COMPOSE_MANIFEST.tools.map((tool) => `${VIDEO_COMPOSE_MANIFEST.namespace ?? ""}.${tool.name}`)).toEqual([
            "nivo.tool.video.compose",
            "nivo.tool.video.render.get",
        ])
    })
})

describe("nivo.tool.video.compose > start", () => {
    it("starts the render on the handed account and answers { renderId, provider } at once", async () => {
        const { service, port } = await build()
        await expect(compose(service, SOUND_SPEC)).resolves.toEqual({ renderId: "r-1", provider: FAKE_COMPOSE })
        expect(port.started).toHaveLength(1)
        expect(port.started[0]?.spec).toEqual(SOUND_SPEC)
    })

    it.each([
        ["a provider that signs nothing", FAKE_UNSIGNED],
        ["a signing provider", FAKE_SIGNED],
    ] as const)("hands %s the door with the connection's own webhook secret as the last segment", async (_name, webhook) => {
        const { service, port } = await build({ webhook })
        await compose(service, SOUND_SPEC)
        expect(port.started[0]?.callback).toEqual({
            url: `${ORIGIN}/api/connections/video-render/${FAKE_COMPOSE}/${ACCOUNT.id}/${HOOK_SECRET}`,
        })
    })

    it("reads no secret for a provider with no webhook", async () => {
        const { service, connections } = await build({ webhook: null })
        await compose(service, SOUND_SPEC)
        expect(connections.readSecret).not.toHaveBeenCalled()
    })

    it("hands no callback without a public origin (a local stack) or for a provider with no webhook", async () => {
        const local = await build({ origin: null })
        await compose(local.service, SOUND_SPEC)
        const silent = await build({ webhook: null })
        await compose(silent.service, SOUND_SPEC)
        expect([local.port.started[0]?.callback, silent.port.started[0]?.callback]).toEqual([null, null])
    })
})

describe("nivo.tool.video.compose > refusals", () => {
    it.each<readonly [string, ComposeSpec, string]>([
        ["a caption that ends before it starts", { ...SOUND_SPEC, captions: [{ text: "x", fromMs: 3000, toMs: 3000 }] }, "captions.0"],
        ["a trim that ends before it starts", { ...SOUND_SPEC, clips: [{ fileUrl: "https://s.test/a.mp4", trimMs: { fromMs: 9, toMs: 2 } }] }, "clips.0.trimMs"],
        [
            "two music beds",
            {
                ...SOUND_SPEC,
                audio: [
                    { fileUrl: "https://s.test/m1.mp3", role: "music" },
                    { fileUrl: "https://s.test/m2.mp3", role: "music" },
                ],
            },
            "audio",
        ],
    ])("refuses %s as invalid_spec (business) and asks no provider", async (_name, spec, member) => {
        const { service, port } = await build()
        const thrown = await thrownOf(compose(service, spec))
        expect(thrown).toMatchObject({ code: ToolsErrorCode.NativeRefused, reason: "invalid_spec", refusalClass: "business" })
        expect(String(thrown.detail)).toContain(member)
        expect(port.started).toHaveLength(0)
    })

    it("refuses a file that is no https address before anything runs (the schema: invalid arguments)", async () => {
        const { service, port } = await build()
        const spec = { ...SOUND_SPEC, clips: [{ fileUrl: "http://store.test/c1.mp4" }] }
        await expect(thrownOf(compose(service, spec))).resolves.toMatchObject({ code: ToolsErrorCode.InvalidArguments })
        expect(COMPOSE_SPEC_SCHEMA.safeParse(spec).success).toBe(false)
        expect(port.started).toHaveLength(0)
    })

    it("answers the provider's refusal of the spec as provider_refused (business), its words as the detail", async () => {
        const { service } = await build()
        await expect(thrownOf(compose(service, { ...SOUND_SPEC, resolution: "1080" }))).resolves.toMatchObject({
            reason: "provider_refused",
            refusalClass: "business",
            detail: "1080 is not offered on this plan",
        })
    })

    it("answers a refused credential as connection_refused (infrastructure: the step freezes)", async () => {
        const { service } = await build({ found: { ...ACCOUNT, name: "bad" } })
        await expect(thrownOf(compose(service, SOUND_SPEC))).resolves.toMatchObject({
            reason: "connection_refused",
            refusalClass: "infrastructure",
        })
    })

    it.each<readonly [string, Parameters<typeof build>[0], string | null]>([
        ["no account handed", {}, null],
        ["an account of no workspace", { found: null }, ACCOUNT.id],
        ["an account of a provider that composes nothing", { found: composeAccountOf(ACCOUNT.id, "veo") }, ACCOUNT.id],
    ])("answers %s as not_connected (infrastructure)", async (_name, options, connectionId) => {
        const built = await build(options)
        await expect(thrownOf(compose(built.service, SOUND_SPEC, connectionId))).resolves.toMatchObject({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
    })
})

describe("nivo.tool.video.render.get (the polling fallback)", () => {
    it("answers the render as the provider's status maps it, absent members as null", async () => {
        const port = new FakeComposePort(FAKE_COMPOSE, null, {
            "r-9": { renderId: "r-9", status: "done", outputUrl: "https://cdn.test/r-9.mp4" },
            "r-8": { renderId: "r-8", status: "rendering" },
        })
        const { service } = await build({ port })
        const read = (renderId: string) => service.invoke("ws-1", VIDEO_COMPOSE_TOOL.renderGet, { renderId }, caller(ACCOUNT.id))
        await expect(read("r-9")).resolves.toEqual({
            renderId: "r-9",
            status: "done",
            outputUrl: "https://cdn.test/r-9.mp4",
            error: null,
            provider: FAKE_COMPOSE,
        })
        await expect(read("r-8")).resolves.toMatchObject({ status: "rendering", outputUrl: null })
        await expect(thrownOf(read("r-7"))).resolves.toMatchObject({ reason: "not_found", refusalClass: "business" })
    })
})

describe("the refusal classes", () => {
    it("class business exactly the closed sets the SDK's refusal types name", () => {
        const business = Object.entries(VIDEO_COMPOSE_REFUSAL_CLASS)
            .filter(([, refusalClass]) => refusalClass === "business")
            .map(([reason]) => reason)
            .sort()
        expect(business).toEqual([...VIDEO_COMPOSE_BUSINESS_REFUSALS, ...VIDEO_RENDER_GET_BUSINESS_REFUSALS].sort())
    })
})
