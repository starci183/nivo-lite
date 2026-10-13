import type { ModuleTextRequest, TextResult } from "./module-ops.contracts"

/** The text generator behind the workspace's agent runtime. It is also the injection token. */
export abstract class ModuleTextGenerator {
    /** Writes one text; a model failure answers `ok: false`, it does not throw. */
    abstract generate(request: ModuleTextRequest): Promise<TextResult>
}
