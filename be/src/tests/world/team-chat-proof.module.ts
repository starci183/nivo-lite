import { Injectable, Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentDirectoryService } from "@modules/domain/agents"
import { TEAM_CHAT_STORAGE, TEAM_CHAT_TAGS, TeamChatFilesService, TeamChatService } from "@modules/domain/team-chat"
import type { TeamChatTags } from "@modules/domain/team-chat"
import { WorkspaceMemberSeatsService, WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { OBJECT_STORAGE_ERROR_CODES } from "@starci/object-storage"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { IdsModule } from "@modules/platform/ids"

/** What a tag handed to the work core, as the proof records it. */
export interface RecordedTag {
    /** The workspace. */
    readonly workspaceId: string
    /** The tag as the chat handed it over. */
    readonly tag: Parameters<TeamChatTags["handOff"]>[1]
}

@Injectable()
/** The work core of a proof: it records every hand-off and allows the agents it was told to allow. */
export class TeamChatTagRecorder implements TeamChatTags {
    /** The hand-offs in the order they came. */
    readonly handed: Array<RecordedTag> = []
    /** The agents the proof lets a person hand work to. */
    allowed: ReadonlyArray<string> = []

    /** Records the hand-off; true for an allowed agent. */
    handOff(workspaceId: string, tag: RecordedTag["tag"]): Promise<boolean> {
        this.handed.push({ workspaceId, tag })
        return Promise.resolve(this.allowed.includes(tag.agentId))
    }
}

@Injectable()
/** The private store of a proof: it keeps the sizes of the objects the proof says were uploaded, and what was removed. */
export class TeamChatProofStorage implements Pick<
    StorageObjectsPort,
    "signedUpload" | "sizeOf" | "signedUrls" | "remove"
> {
    /** The size of each uploaded object, by path. */
    readonly sizes = new Map<string, number>()
    /** The paths that were removed. */
    readonly removed: Array<string> = []
    /** Whether the store answers. */
    reachable = true

    /** An address for the path; none when the store is down. */
    signedUpload(_bucket: string, path: string): ReturnType<StorageObjectsPort["signedUpload"]> {
        return Promise.resolve(
            this.reachable
                ? { kind: "ok", value: { path, token: "", signedUrl: `https://store.test/put/${path}` } }
                : { kind: "refused", code: OBJECT_STORAGE_ERROR_CODES.Unavailable },
        )
    }

    /** The size the proof gave the object. */
    sizeOf(_bucket: string, path: string): ReturnType<StorageObjectsPort["sizeOf"]> {
        const size = this.sizes.get(path)
        return Promise.resolve(
            size === undefined
                ? { kind: "refused", code: OBJECT_STORAGE_ERROR_CODES.ObjectNotFound }
                : { kind: "ok", value: size },
        )
    }

    /** An address for each object the proof knows. */
    signedUrls(_bucket: string, paths: ReadonlyArray<string>): ReturnType<StorageObjectsPort["signedUrls"]> {
        return Promise.resolve({
            kind: "ok",
            value: paths
                .filter((path) => this.sizes.has(path))
                .map((path) => ({ path, signedUrl: `https://store.test/get/${path}` })),
        })
    }

    /** Removes the objects. */
    remove(_bucket: string, paths: ReadonlyArray<string>): ReturnType<StorageObjectsPort["remove"]> {
        this.removed.push(...paths)
        paths.forEach((path) => this.sizes.delete(path))
        return Promise.resolve({ kind: "ok", value: paths.length })
    }
}

@Module({
    imports: [IdsModule.register({})],
    providers: [
        TeamChatService,
        TeamChatFilesService,
        WorkspaceMemberSeatsService,
        WorkspaceMembersReadService,
        AgentDirectoryService,
        TeamChatTagRecorder,
        TeamChatProofStorage,
        { provide: TEAM_CHAT_TAGS, useExisting: TeamChatTagRecorder },
        { provide: TEAM_CHAT_STORAGE, useExisting: TeamChatProofStorage },
    ],
    exports: [TeamChatService, TeamChatTagRecorder, TeamChatProofStorage],
})
/** Runs the team chat over the private PostgreSQL proof database with the capabilities it reads people and agents through. */
export class TeamChatProofModule {
    /** Registers only what the team chat proofs need. */
    static register(): DynamicModule {
        return { module: TeamChatProofModule }
    }
}
