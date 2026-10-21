import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectWorkPerformerRegistry } from "@modules/domain/decisions"
import type {
    Performed,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkPerformerRegistry,
} from "@modules/domain/decisions"
import { VideoDelegationsService } from "@modules/domain/video-delegations"
import type { DelegationIdRow } from "@modules/domain/video-delegations"
import { VideoProjectWorkbenchWriterService } from "@modules/domain/video-projects"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { projectHref, readDelegation, renderingCard } from "./editor-delegation.policy"
import type { DelegatedScript, RenderingWords } from "./editor-delegation.contracts"
import { EditorRoomService } from "./editor-room.service"
import { VideoService } from "./video.service"

/** The command another agent sends AI Editor: render this script. */
export const RENDER_SCRIPT_ACTION = "render_script"

@Injectable()
/**
 * AI Editor's render_script effect. Another agent (AI Marketing) delegates a script through the command bus; AI Editor turns it into a
 * video project of the workspace, records the delegation and queues the real render with the workspace brand kit and the brand frame.
 * Performing the same work item again answers the project it already made.
 */
export class EditorDelegationPerformerService implements WorkPerformer, OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectWorkPerformerRegistry() private readonly registry: WorkPerformerRegistry,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly video: VideoService,
        private readonly projects: VideoProjectWorkbenchWriterService,
        private readonly delegations: VideoDelegationsService,
        private readonly room: EditorRoomService,
    ) {}

    /** Registers the effect with the work engine. */
    onModuleInit(): void {
        this.registry.add(RENDER_SCRIPT_ACTION, this)
    }

    /** The delegated script is the proposal as the command sent it. */
    prepare(_ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        return Promise.resolve({ proposal: item.proposal })
    }

    /** Creates the project and its delegation and queues the render; a script that cannot be rendered is refused. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal): Promise<Performed> {
        const script = readDelegation(proposal.fields, ctx.workspaceId)
        if (script === null) throw new VideoError({ code: VideoErrorCode.InputInvalid })
        const existing = await this.delegations.ofWorkItem(ctx.workspaceId, item.id)
        if (existing !== null) return this.performed(ctx, script, existing.project_id)
        const delegation = await this.entityManager.transaction((tx) =>
            this.record(tx, ctx.workspaceId, item.id, script),
        )
        const queued = await this.video.requestDelegatedRender(ctx.workspaceId, delegation.project_id)
        await this.delegations.linkRender(delegation.id, queued.renderId)
        const performed = this.performed(ctx, script, delegation.project_id)
        await this.room.post(
            ctx,
            performed.summary,
            renderingCard(script, this.renderingWords(ctx, script), {
                projectId: delegation.project_id,
                renderId: queued.renderId,
            }),
            item.id,
        )
        return performed
    }

    private async record(
        tx: EntityManager,
        workspaceId: string,
        itemId: string,
        script: DelegatedScript,
    ): Promise<DelegationIdRow> {
        const projectId = await this.projects.createDelegated(tx, workspaceId, {
            title: script.title,
            goal: script.goal,
            aspect: script.aspect,
            targetSeconds: script.targetSeconds,
            script: script.scenes,
        })
        if (projectId === null) throw new VideoError({ code: VideoErrorCode.InputInvalid })
        const delegation = await this.delegations.record(tx, {
            workspaceId,
            workItemId: itemId,
            projectId,
            sourceModule: script.source,
            contentItemId: script.contentItemId,
            channels: script.channels,
        })
        if (delegation === null) throw new VideoError({ code: VideoErrorCode.InputInvalid })
        return delegation
    }

    private renderingWords(ctx: WorkContext, script: DelegatedScript): RenderingWords {
        const text = (key: string, params: Readonly<Record<string, string | number>> = {}): string =>
            this.catalog.get(key, params, ctx.locale)
        return {
            badge: text("video.editor.rendering.badge"),
            body: text("video.editor.rendering.body"),
            link: text("video.editor.rendering.link"),
            target: text("video.editor.rendering.target"),
            seconds: text("video.editor.seconds", { seconds: script.targetSeconds }),
        }
    }

    private performed(ctx: WorkContext, script: DelegatedScript, projectId: string): Performed {
        return {
            summary: this.catalog.get(
                "video.editor.delegated",
                { title: script.title, scenes: script.scenes.length },
                ctx.locale,
            ),
            evidence: "captured",
            href: projectHref(projectId),
            detail: projectId,
        }
    }
}
