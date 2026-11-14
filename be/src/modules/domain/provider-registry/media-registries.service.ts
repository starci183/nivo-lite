import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { InvoiceIssuePort } from "./invoice-ports.contracts"
import type { DubbingPort, ProviderFileReader, SpeechPort, VideoGenerationPort } from "./media-ports.contracts"

@Injectable()
/** The providers that turn text into speech. */
export class SpeechRegistryService extends ProviderRegistryService<SpeechPort> {}

@Injectable()
/** The providers that dub a video or audio into another language. */
export class DubbingRegistryService extends ProviderRegistryService<DubbingPort> {}

@Injectable()
/** The providers that generate a video. */
export class VideoGenerationRegistryService extends ProviderRegistryService<VideoGenerationPort> {}

@Injectable()
/** The providers that open one of their files again by its handle (what the generic file store takes a file through). */
export class ProviderFileRegistryService extends ProviderRegistryService<ProviderFileReader> {}

@Injectable()
/** The providers that issue e-invoices. */
export class InvoiceIssueRegistryService extends ProviderRegistryService<InvoiceIssuePort> {}

/** The registries of the generic media and invoice purposes, as the registry module provides and exports them. */
export const PURPOSE_REGISTRIES: readonly [
    typeof SpeechRegistryService,
    typeof DubbingRegistryService,
    typeof VideoGenerationRegistryService,
    typeof ProviderFileRegistryService,
    typeof InvoiceIssueRegistryService,
] = [
    SpeechRegistryService,
    DubbingRegistryService,
    VideoGenerationRegistryService,
    ProviderFileRegistryService,
    InvoiceIssueRegistryService,
] as const
