import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "@modules/domain/provider-registry/provider-registry.service"
import type { VideoComposePort } from "./video-compose.contracts"

@Injectable()
/**
 * The providers that compose a video in their cloud, by provider key, on the one registry of every provider port (live and sandbox,
 * lane concept provider-sandbox). A provider module registers once at boot; the compose tools resolve an ACCOUNT's port through
 * `portFor`, the render door (the provider's own webhook) its provider's live port through `liveOf`.
 */
export class VideoComposeRegistryService extends ProviderRegistryService<VideoComposePort> {}
