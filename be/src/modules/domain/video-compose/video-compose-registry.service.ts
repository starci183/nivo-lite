import { Injectable } from "@nestjs/common"
import type { VideoComposePort } from "./video-compose.contracts"

/** A compose port, or undefined for a provider that registered none. */
export type OptionalVideoComposePort = VideoComposePort | undefined

@Injectable()
/**
 * The providers that compose a video in their cloud, by provider key. A provider module registers its port once at boot (its
 * registration service's `onModuleInit`); the compose tools and the render door look a port up by the provider of a connection and never
 * name a provider. A second registration under a key replaces the first.
 */
export class VideoComposeRegistryService {
    private readonly ports = new Map<string, VideoComposePort>()

    /** Registers the port under its provider key. */
    register(port: VideoComposePort): void {
        this.ports.set(port.provider, port)
    }

    /** The port of a provider, or undefined when none registered. */
    of(provider: string): OptionalVideoComposePort {
        return this.ports.get(provider)
    }

    /** Every registered port, in registration order. */
    all(): ReadonlyArray<VideoComposePort> {
        return [...this.ports.values()]
    }
}
