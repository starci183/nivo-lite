import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { VideoDelegationsService } from "@modules/domain/video-delegations"
import type { DelegationRenderRow } from "@modules/domain/video-delegations"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { EditorDeliveryService } from "./editor-delivery.service"
import { EditorRoomService } from "./editor-room.service"
import { VideoMediaService } from "./video-media.service"

/** A substring matcher, typed `unknown` so it flows into any slot. */
const stringLike = (text: string): unknown => expect.stringContaining(text)

/** A sub-array matcher, typed `unknown` so it flows into any slot. */
const arrayLike = (items: ReadonlyArray<unknown>): unknown => expect.arrayContaining(items)

const WORKSPACE = "0a1b2c3d-0a1b-4c3d-8a1b-0a1b2c3d4e5f"
const CTX = { workspaceId: WORKSPACE, actor: "AI Editor", locale: "vi" }

const rowOf = builder<DelegationRenderRow>({
    id: "delegation-1",
    workspace_id: WORKSPACE,
    work_item_id: "item-1",
    project_id: "project-1",
    source_module: "content",
    channels: ["facebook", "zalo"],
    title: "Weekend",
    aspect: "9:16",
    script: [
        { caption: "A quiet moment", voiceover: "a", media: null },
        { caption: "20% off", voiceover: "b", media: null },
    ],
    render_id: "render-1",
    render_status: "done",
    duration_ms: 15_000,
    output_path: `${WORKSPACE}/render-1/video.mp4`,
    poster_path: `${WORKSPACE}/render-1/poster.jpg`,
    captions_path: `${WORKSPACE}/render-1/captions.vtt`,
    captions_lang: "vi-VN",
    voiceover: "captions_only",
    error: null,
})

const approvalOf = builder<WorkItem>({
    id: "approval-1",
    workspace_id: WORKSPACE,
    department: "video",
    action: "publish_video",
    subject_type: "video_project",
    subject_id: "project-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: "item-1",
    chain_id: "item-1",
    depth: 1,
    status: "waiting_decision",
    decided_path: null,
    reason: "over_authority",
    reasons: ["over_authority"],
    missing_fields: [],
    proposal: { summary: "Weekend", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-20T09:00:00.000Z",
    updated_at: "2026-10-20T09:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

const build = async (row: DelegationRenderRow | null, settled = true) => {
    const delegations = mock<VideoDelegationsService>()
    delegations.ofSettledRender.mockResolvedValue(row)
    delegations.markReady.mockResolvedValue(settled)
    delegations.markFailed.mockResolvedValue(settled)
    delegations.saveCard.mockResolvedValue(undefined)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) =>
        Object.keys(params ?? {}).length === 0 ? key : `${key}:${JSON.stringify(params)}`,
    )
    const engine = mock<WorkEngineService>()
    engine.runWork.mockResolvedValue(approvalOf())
    const media = mock<VideoMediaService>()
    media.shareLink.mockImplementation((_workspace, path) => Promise.resolve(`https://signed/${path}`))
    const room = mock<EditorRoomService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EditorDeliveryService,
            { provide: VideoDelegationsService, useValue: delegations },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkEngineService, useValue: engine },
            { provide: VideoMediaService, useValue: media },
            { provide: EditorRoomService, useValue: room },
        ],
    }).compile()
    return { delivery: moduleRef.get(EditorDeliveryService), delegations, engine, media, room }
}

describe("EditorDeliveryService", () => {
    it("changes nothing for a render nobody delegated", async () => {
        const { delivery, delegations, room } = await build(null)

        await delivery.settle("render-1")

        expect(delegations.markReady).not.toHaveBeenCalled()
        expect(room.post).not.toHaveBeenCalled()
    })

    it("opens the approval, posts the video_ready card that decides it and asks in one line", async () => {
        const { delivery, delegations, engine, room } = await build(rowOf())

        await delivery.settle("render-1")

        expect(delegations.markReady).toHaveBeenCalledWith("delegation-1")
        expect(engine.runWork).toHaveBeenCalledWith(CTX, {
            action: "publish_video",
            subject_type: "video_project",
            subject_id: "project-1",
            parent_id: "item-1",
            preset: true,
            noChain: true,
            forceAsk: "over_authority",
            dedupeKey: "publish_video:project-1:render-1",
            seed: {
                summary: "Weekend",
                draft: "A quiet moment\n20% off",
                fields: { project_id: "project-1", render_id: "render-1", title: "Weekend", channels: "facebook,zalo" },
            },
        })
        const [ready] = room.post.mock.calls
        expect(ready?.[1]).toBe('video.editor.ready:{"title":"Weekend","seconds":15}')
        expect(ready?.[2]).toMatchObject({
            type: "video_ready",
            media: [
                { kind: "video", url: `https://signed/${WORKSPACE}/render-1/video.mp4` },
                { kind: "image", url: `https://signed/${WORKSPACE}/render-1/poster.jpg` },
            ],
            fields: arrayLike([{ label: "video.editor.voice", value: "video.editor.voice.captions_only" }]),
            ref: { kind: "work_item", id: "approval-1" },
            data: { captions_url: `https://signed/${WORKSPACE}/render-1/captions.vtt`, source: "content" },
        })
        expect(ready?.[3]).toBe("item-1")
        expect(room.say).toHaveBeenCalledWith(CTX, 'video.editor.approval:{"title":"Weekend"}', "approval-1")
        expect(delegations.saveCard).toHaveBeenCalledWith("delegation-1", "approval-1", ready?.[2])
    })
})

describe("EditorDeliveryService > partial and failed renders", () => {
    it("names a render without voice and links nothing it does not have", async () => {
        const { delivery, room, media } = await build(
            rowOf({ voiceover: null, poster_path: null, captions_path: null, duration_ms: null }),
        )

        await delivery.settle("render-1")

        expect(media.shareLink).toHaveBeenCalledTimes(1)
        expect(room.post.mock.calls[0]?.[2]).toMatchObject({
            fields: arrayLike([{ label: "video.editor.voice", value: "video.editor.voice.none" }]),
        })
    })

    it("names a render spoken by the AI voice", async () => {
        const { delivery, room } = await build(rowOf({ voiceover: "tts" }))

        await delivery.settle("render-1")

        expect(room.post.mock.calls[0]?.[2]).toMatchObject({
            fields: arrayLike([{ label: "video.editor.voice", value: "video.editor.voice.tts" }]),
        })
    })

    it("posts nothing when another call already settled the delegation", async () => {
        const { delivery, engine, room } = await build(rowOf(), false)

        await delivery.settle("render-1")

        expect(engine.runWork).not.toHaveBeenCalled()
        expect(room.post).not.toHaveBeenCalled()
    })

    it("says in one line that a delegated render failed", async () => {
        const { delivery, delegations, room, engine } = await build(
            rowOf({ render_status: "failed", error: "ffmpeg crashed" }),
        )

        await delivery.settle("render-1")

        expect(delegations.markFailed).toHaveBeenCalledWith("delegation-1", "ffmpeg crashed")
        expect(room.say).toHaveBeenCalledWith(
            CTX,
            'video.editor.failed:{"title":"Weekend","reason":"ffmpeg crashed"}',
            "item-1",
        )
        expect(engine.runWork).not.toHaveBeenCalled()
    })

    it("fails a done render without a file with a generic reason, once", async () => {
        const first = await build(rowOf({ output_path: null }))
        await first.delivery.settle("render-1")
        expect(first.room.say).toHaveBeenCalledWith(CTX, stringLike("render failed"), "item-1")

        const again = await build(rowOf({ render_status: "failed" }), false)
        await again.delivery.settle("render-1")
        expect(again.room.say).not.toHaveBeenCalled()
    })
})
