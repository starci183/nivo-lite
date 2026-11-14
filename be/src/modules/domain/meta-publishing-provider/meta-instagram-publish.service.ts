import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { eachInOrder } from "@modules/platform/primitives"
import {
    providerRefusal,
    withProof,
    type ProviderRegistryError,
    type InstagramCarouselItem,
    type InstagramContainer,
    type InstagramMediaRequest,
    type InstagramPublishPort,
    type InstagramPublishState,
} from "@modules/domain/provider-registry"
import {
    INSTAGRAM_CAROUSEL_MAX,
    InjectMetaPublishing,
    type ContainerRequest,
    type ContainerStatusCode,
    type MetaPublishingAccess,
    type MetaPublishingClient,
} from "@modules/integrations/meta-publishing"
import { MetaPublishingCredentialService } from "./meta-publishing-credential.service"
import { META_PROVIDER, metaPublishingFailureOf } from "./meta-publishing-failure.policy"
import { DomainError } from "@modules/platform/errors"

/** Where a documented `status_code` leaves the container: still processing, finished (publishable), published, or never publishable. */
const STATE_OF_CODE: Readonly<Record<ContainerStatusCode, InstagramPublishState>> = {
    IN_PROGRESS: "pending",
    FINISHED: "ready",
    PUBLISHED: "published",
    ERROR: "failed",
    EXPIRED: "failed",
}

const NO_FIELDS: ContainerRequest = {
    mediaType: null,
    imageUrl: null,
    videoUrl: null,
    caption: null,
    altText: null,
    isCarouselItem: null,
    children: [],
    aiGenerated: null,
}

const refused = (provider: string, detail: string): ProviderRegistryError =>
    withProof(providerRefusal(provider, "rejected", detail), "not_sent")

@Injectable()
/**
 * Meta as the adapter of the Instagram destination (`InstagramPublishPort`): a container is created (a carousel first creates one
 * container per item), its `status_code` is read once, and a FINISHED container is published (`media_publish`) in the same call; any
 * other state is answered as it stands and a later `status` call goes on. No wait loop: Instagram's own guidance is to poll about once a
 * minute, which is the caller's schedule, not this adapter's.
 */
export class MetaInstagramPublishService implements InstagramPublishPort {
    /** The provider key. */
    readonly provider: string = META_PROVIDER

    constructor(
        @InjectMetaPublishing() private readonly client: MetaPublishingClient,
        private readonly credentials: MetaPublishingCredentialService,
    ) {}

    /** Creates the container (and its children), then reads it and publishes it when it is finished. */
    async publish(connection: ConnectionRecord, request: InstagramMediaRequest): Promise<InstagramContainer> {
        const fields = this.fieldsOf(request)
        const access = await this.credentials.instagramAccessOf(connection)
        try {
            const containerId = await this.createContainer(access, request, fields)
            return await this.stand(access, containerId, true)
        } catch (cause) {
            const failure = metaPublishingFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    /** Reads a container created earlier and publishes it when it is finished. */
    release(connection: ConnectionRecord, containerId: string): Promise<InstagramContainer> {
        return this.read(connection, containerId, true)
    }

    /** Reads one container: a pure read. */
    status(connection: ConnectionRecord, containerId: string): Promise<InstagramContainer> {
        return this.read(connection, containerId, false)
    }

    private async read(
        connection: ConnectionRecord,
        containerId: string,
        publish: boolean,
    ): Promise<InstagramContainer> {
        const access = await this.credentials.instagramAccessOf(connection)
        try {
            return await this.stand(access, containerId, publish)
        } catch (cause) {
            const failure = metaPublishingFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }

    /** The container's request fields for a kind; a request that does not fit its kind is refused before anything is sent. */
    private fieldsOf(request: InstagramMediaRequest): ContainerRequest {
        const base = { ...NO_FIELDS, caption: request.caption, aiGenerated: request.aiGenerated }
        if (request.mediaType === "carousel") {
            if (request.children.length < 1 || request.children.length > INSTAGRAM_CAROUSEL_MAX)
                throw refused(this.provider, "carousel items")
            return { ...base, mediaType: "CAROUSEL" }
        }
        if (request.mediaUrl === null) throw refused(this.provider, "media url")
        switch (request.mediaType) {
            case "image":
                return { ...base, imageUrl: request.mediaUrl, altText: request.altText }
            case "video":
                return { ...base, mediaType: "VIDEO", videoUrl: request.mediaUrl }
            case "reels":
                return { ...base, mediaType: "REELS", videoUrl: request.mediaUrl }
        }
    }

    private async createContainer(
        access: MetaPublishingAccess,
        request: InstagramMediaRequest,
        fields: ContainerRequest,
    ): Promise<string> {
        if (request.mediaType !== "carousel") return this.client.createContainer(access, fields)
        const children: Array<string> = []
        // One at a time: Instagram counts each container, and a refusal stops the rest.
        await eachInOrder(request.children, async (item) => {
            children.push(await this.client.createContainer(access, this.childOf(item)))
        })
        return this.client.createContainer(access, { ...fields, children })
    }

    private childOf(item: InstagramCarouselItem): ContainerRequest {
        return item.kind === "image"
            ? { ...NO_FIELDS, imageUrl: item.url, isCarouselItem: true }
            : { ...NO_FIELDS, mediaType: "VIDEO", videoUrl: item.url, isCarouselItem: true }
    }

    /** Where the container stands; a finished one is published when asked. */
    private async stand(
        access: MetaPublishingAccess,
        containerId: string,
        publish: boolean,
    ): Promise<InstagramContainer> {
        const statusCode = await this.client.containerStatus(access, containerId)
        if (statusCode === "FINISHED" && publish) {
            const mediaId = await this.client.publishContainer(access, containerId)
            return { containerId, state: "published", statusCode: "PUBLISHED", mediaId }
        }
        return { containerId, state: STATE_OF_CODE[statusCode], statusCode, mediaId: null }
    }
}
