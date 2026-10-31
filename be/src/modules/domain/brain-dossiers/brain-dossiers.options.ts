/**
 * The brain-dossiers capability takes one option, set by the app root: the read-only mode (the mcp app) registers the dossier read
 * alone, with nothing that imports or changes a checklist.
 */
export interface BrainDossiersOptions {
    /** True registers the read-only mode; absent or false, the full capability. */
    readonly readOnly?: boolean
}
