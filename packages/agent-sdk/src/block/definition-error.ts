import { DomainError } from "@starci/common"

/** The codes a definition is refused with. */
export type DefinitionErrorCode =
    | "ID_MALFORMED"
    | "BLOCK_PROPS_UNSERIALIZABLE"
    | "READ_VARIABLES_UNSERIALIZABLE"
    | "NODE_CONDITION_BRANCH"
    | "NODE_CONDITION_EFFECTS"
    | "REQUIRES_UNDECLARED"
    | "DATA_KIND_MALFORMED"
    | "MODULE_LIST_INVALID"
    | "WORKBENCH_INVALID"
    | "WORKBENCH_KEY_DUPLICATE"
    | "PLAN_BLOCK_UNKNOWN"
    | "PACKAGE_REFUSED"
    | "PORT_UNPROVIDED"
    | "LIST_SHAPE_INVALID"
    | "LIST_JOIN_PORT_RESERVED"
    | "COUNTS_BY_UNKNOWN"
    | "MODULE_ID_OUTSIDE"
    | "MODULE_PERMISSION_UNDECLARED"
    | "MODULE_REFRESH_UNKNOWN"
    | "MODULE_COUNTS_UNKNOWN"
    | "MODULE_CONTACT_BLOCK_DUPLICATE"
    | "MODULE_CONTACT_BLOCK_READ_UNKNOWN"
    | "MODULE_CONTACT_BLOCK_NO_CONTACT_VARIABLE"
    | "INSTALLATION_ID_DUPLICATE"
    | "MESSAGE_KIND_CORE_ID"
    | "MESSAGE_KIND_VERDICT"
    | "PLUGIN_ACCESS_INVALID"
    | "SOURCE_RESERVED"
    | "RECORD_QUERY_OTHER_AGENT"
    | "SERVICE_MODULE_MISMATCH"

/**
 * Thrown at module load by `defineBlock`, `defineRead`, `defineAction`, `defineNode`, `defineEffect`, `definePort`, `defineService`, `defineServiceContract`, `defineModule`, `listRead`, `countsRead`, `defineInstallation`, `definePlugin` and `defineDataKind`, so a bad
 * definition fails its own package.
 */
export class SdkDefinitionError extends DomainError<DefinitionErrorCode> {
    constructor(code: DefinitionErrorCode, at: string, options?: ErrorOptions) {
        super({ code, params: { at }, cause: options?.cause })
    }
}
