import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AttachProviderByTemplateRequest } from "./attach-provider-by-template.contracts"

/** Attaches the listed agents to a provider by their template. */
export class AttachProviderByTemplateCommand extends Command<ReadonlyArray<string>> {
    constructor(readonly params: ExecuteParams<AttachProviderByTemplateRequest>) {
        super()
    }
}
