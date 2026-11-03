/** The codes a definition is refused with. */
export type DefinitionErrorCode = "ID_MALFORMED" | "BLOCK_PROPS_UNSERIALIZABLE" | "READ_VARIABLES_UNSERIALIZABLE"

/** Thrown at module load by `defineBlock`, `defineRead`, `defineAction` and `defineNode`, so a bad definition fails its own package. */
export class SdkDefinitionError extends Error {
    readonly code: DefinitionErrorCode
    readonly at: string

    constructor(code: DefinitionErrorCode, at: string) {
        super(`${code}: ${at}`)
        this.name = "SdkDefinitionError"
        this.code = code
        this.at = at
    }
}
