import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type ProviderFile,
    type ProviderFileReader,
    type VideoGenerationPort,
    type VideoJob,
    type VideoRequest,
    type VideoStarted,
} from "@modules/domain/provider-registry"
import { InjectVeo, type VeoClient, type VeoOperation } from "@modules/integrations/veo"
import { VEO_MODEL, VeoCredentialService } from "./veo-credential.service"
import { VEO_PROVIDER, veoFailureOf } from "./veo-failure.policy"
import { DomainError } from "@modules/platform/errors"

/** The media type of a generated video (the guide saves it as `.mp4`). */
const VIDEO_MP4 = "video/mp4"

/**
 * Where a generation stands, by the operation's documented members alone: not `done` is running; `done` with `error` failed; `done`
 * otherwise is done, with the videos it answered (none when the filters of Veo blocked it).
 */
export const videoStateOf = (operation: VeoOperation): VideoJob["state"] => {
    if (!operation.done) return "pending"
    return operation.error === null ? "done" : "failed"
}

@Injectable()
/**
 * Veo (through the Gemini API) as the adapter of the generic video purpose (`VideoGenerationPort`: a long-running operation started,
 * then polled) and of its files (`ProviderFileReader`: a video reopened by its URI, which Google keeps for 2 days). The model is the
 * one the request names, else the account's own (`meta.model`); without either nothing is sent (`rejected`).
 */
export class VeoVideoService implements VideoGenerationPort, ProviderFileReader {
    /** The provider key. */
    readonly provider: string = VEO_PROVIDER

    constructor(
        @InjectVeo() private readonly client: VeoClient,
        private readonly credentials: VeoCredentialService,
    ) {}

    /** Starts one generation (`POST models/{model}:predictLongRunning`). */
    async start(connection: ConnectionRecord, request: VideoRequest): Promise<VideoStarted> {
        const model = request.modelId ?? connection.meta[VEO_MODEL] ?? ""
        if (model === "") throw withProof(providerRefusal(this.provider, "rejected", "model"), "not_sent")
        const key = await this.credentials.keyOf(connection)
        const operation = await this.guarded(() =>
            this.client.generate(key, {
                model,
                prompt: request.prompt,
                image: request.image,
                aspectRatio: request.aspectRatio,
                resolution: request.resolution,
                durationSeconds: request.durationSeconds,
                personGeneration: request.personGeneration,
                seed: request.seed,
            }),
        )
        return { jobId: operation.name, modelId: model }
    }

    /** The generation as it stands (`GET {operation name}`); once done, one file per generated video. */
    async get(connection: ConnectionRecord, jobId: string): Promise<VideoJob> {
        const key = await this.credentials.keyOf(connection)
        const operation = await this.guarded(() => this.client.operation(key, jobId))
        const state = videoStateOf(operation)
        return {
            jobId: operation.name,
            state,
            error: operation.error,
            files: state === "done" ? operation.videoUris.map((uri) => this.open(connection, uri)) : [],
        }
    }

    /** The video behind a URI an operation of the account answered, read on `fetch`. */
    open(connection: ConnectionRecord, handle: string): ProviderFile {
        const fetch = async (): Promise<Buffer> => {
            const key = await this.credentials.keyOf(connection)
            const video = await this.guarded(() => this.client.download(key, handle))
            return video.bytes
        }
        return { provider: this.provider, handle, mimeType: VIDEO_MP4, expiresAt: null, fetch }
    }

    private async guarded<T>(call: () => Promise<T>): Promise<T> {
        try {
            return await call()
        } catch (cause) {
            const failure = veoFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
