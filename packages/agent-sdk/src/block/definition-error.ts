import { SdkError } from "../sdk-error"

/** The codes a definition is refused with. */
export type DefinitionErrorCode =
    | "ID_MALFORMED"
    | "BLOCK_PROPS_UNSERIALIZABLE"
    | "READ_VARIABLES_UNSERIALIZABLE"
    | "NODE_CONDITION_BRANCH"
    | "NODE_CONDITION_EFFECTS"
    | "DATA_KIND_MALFORMED"
    | "MODULE_LIST_INVALID"
    | "WORKBENCH_INVALID"
    | "WORKBENCH_KEY_DUPLICATE"
    | "PLAN_BLOCK_UNKNOWN"
    | "PACKAGE_REFUSED"

/**
 * Thrown at module load by `defineBlock`, `defineRead`, `defineAction`, `defineNode`, `defineEffect` and `defineDataKind`, so a bad
 * definition fails its own package.
 */
export class SdkDefinitionError extends SdkError<DefinitionErrorCode> {}
