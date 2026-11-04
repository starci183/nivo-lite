import { SdkError } from "../sdk-error"

/** The codes a definition is refused with. */
export type DefinitionErrorCode = "ID_MALFORMED" | "BLOCK_PROPS_UNSERIALIZABLE" | "READ_VARIABLES_UNSERIALIZABLE"

/** Thrown at module load by `defineBlock`, `defineRead`, `defineAction` and `defineNode`, so a bad definition fails its own package. */
export class SdkDefinitionError extends SdkError<DefinitionErrorCode> {}
