import { SdkError } from "../sdk-error"

/** The codes a definition is refused with. */
export type DefinitionErrorCode =
    | "ID_MALFORMED"
    | "BLOCK_PROPS_UNSERIALIZABLE"
    | "READ_VARIABLES_UNSERIALIZABLE"
    | "NODE_CONDITION_BRANCH"
    | "NODE_CONDITION_EFFECTS"
    | "DATA_KIND_MALFORMED"

/**
 * Thrown at module load by `defineBlock`, `defineRead`, `defineAction`, `defineNode`, `defineEffect` and `defineDataKind`, so a bad
 * definition fails its own package.
 */
export class SdkDefinitionError extends SdkError {
    declare readonly code: DefinitionErrorCode
    readonly at: string

    constructor(code: DefinitionErrorCode, at: string) {
        super(code, `${code}: ${at}`)
        this.name = "SdkDefinitionError"
        this.at = at
    }
}
