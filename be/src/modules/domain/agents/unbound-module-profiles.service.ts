import { Injectable } from "@nestjs/common"
import type { OptionalText } from "./agents.contracts"
import type { ModuleProfiles } from "./agents.port"

@Injectable()
/** The module profiles of an app whose modules lane has not landed: no module adds a folder or a reply contract. */
export class UnboundModuleProfilesService implements ModuleProfiles {
    /** No module names a knowledge folder yet. */
    knowledgeFolderOf(): OptionalText {
        return null
    }

    /** No module has a reply contract yet. */
    replyContractOf(): OptionalText {
        return null
    }

    /** No application clause is added to a prompt yet. */
    applicationClause(): string {
        return ""
    }

    /** No application shape is added to a prompt yet. */
    applicationShape(): string {
        return ""
    }
}
