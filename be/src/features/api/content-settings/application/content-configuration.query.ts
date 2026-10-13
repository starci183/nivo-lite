import { Query } from "@nestjs/cqrs"
import type { ContentConfiguration } from "@modules/domain/content-settings"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ContentConfigurationRequest } from "./content-configuration.contracts"

/** Requests contentConfiguration. */
export class ContentConfigurationQuery extends Query<ContentConfiguration> {
    constructor(readonly params: ExecuteParams<ContentConfigurationRequest>) {
        super()
    }
}
