import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type {
    NewVideoProjectDraft,
    ChangeVideoProjectDraft,
    WrittenVideoProjectId,
} from "./video-project-workbench.contracts"
import {
    APPROVE_VIDEO_PROJECT,
    ARCHIVE_WORKBENCH_PROJECT,
    CREATE_WORKBENCH_PROJECT,
    DUPLICATE_WORKBENCH_PROJECT,
    PUBLISH_WORKBENCH_PROJECT,
    UPDATE_WORKBENCH_PROJECT,
} from "./persistence/video-workbench.sql"

/** Identity returned by an owner write. */
interface ProjectIdentity {
    /** Saved project. */
    readonly id: string
}

@Injectable()
/** The owner of video_projects writes used by the manager workbench and approval gate. */
export class VideoProjectWorkbenchWriterService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Creates a project in the caller's evidence transaction. */
    async create(
        tx: EntityManager,
        workspaceId: string,
        principalId: string,
        input: NewVideoProjectDraft,
    ): Promise<WrittenVideoProjectId> {
        const typed = input.title?.trim() ?? ""
        const [row] = await tx.query<Array<ProjectIdentity>>(CREATE_WORKBENCH_PROJECT, [
            workspaceId,
            typed || `${input.goal} - ${this.clock.now().toISOString().slice(0, 10)}`,
            input.goal,
            input.aspect,
            input.targetSeconds,
            JSON.stringify(input.inputs),
            JSON.stringify(typed === "" ? { auto_title: true } : {}),
            principalId,
        ])
        return row?.id ?? null
    }

    /** Updates an idle project and invalidates a script approval. */
    async update(workspaceId: string, projectId: string, input: ChangeVideoProjectDraft): Promise<boolean> {
        const rows = await this.entityManager.query<Array<ProjectIdentity>>(UPDATE_WORKBENCH_PROJECT, [
            workspaceId,
            projectId,
            input.title ?? null,
            input.goal ?? null,
            input.aspect ?? null,
            input.targetSeconds ?? null,
            input.inputs === undefined ? null : JSON.stringify(input.inputs),
            input.script === undefined ? null : JSON.stringify(input.script),
        ])
        return rows.length > 0
    }

    /** Copies a project inside the caller's evidence transaction. */
    async duplicate(
        tx: EntityManager,
        workspaceId: string,
        projectId: string,
        principalId: string,
    ): Promise<WrittenVideoProjectId> {
        const [row] = await tx.query<Array<ProjectIdentity>>(DUPLICATE_WORKBENCH_PROJECT, [
            workspaceId,
            projectId,
            principalId,
        ])
        return row?.id ?? null
    }

    /** Changes only an idle project's archived status. */
    async archive(workspaceId: string, projectId: string, archived: boolean): Promise<boolean> {
        return (
            (
                await this.entityManager.query<Array<ProjectIdentity>>(ARCHIVE_WORKBENCH_PROJECT, [
                    workspaceId,
                    projectId,
                    archived,
                ])
            ).length > 0
        )
    }

    /** Publishes only an approved project inside the evidence transaction. */
    async publish(tx: EntityManager, workspaceId: string, projectId: string): Promise<boolean> {
        return (await tx.query<Array<ProjectIdentity>>(PUBLISH_WORKBENCH_PROJECT, [workspaceId, projectId])).length > 0
    }

    /** Records the authority performer's human approval of a finished render. */
    async approve(workspaceId: string, projectId: string, renderId: string, approver: string): Promise<boolean> {
        return (
            (
                await this.entityManager.query<Array<ProjectIdentity>>(APPROVE_VIDEO_PROJECT, [
                    workspaceId,
                    projectId,
                    renderId,
                    approver,
                ])
            ).length > 0
        )
    }
}
