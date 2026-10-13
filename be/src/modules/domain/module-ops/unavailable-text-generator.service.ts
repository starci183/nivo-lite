import { Injectable } from "@nestjs/common"
import type { TextResult } from "./module-ops.contracts"
import { TextGenerator } from "./text-generator.port"

@Injectable()
/** The generator used until the agent runtime is connected: it answers that no model answered, so callers fall back to their plain templates. */
export class UnavailableTextGeneratorService extends TextGenerator {
    /** Answers that no text was written. */
    override generate(): Promise<TextResult> {
        return Promise.resolve({ ok: false, output: "" })
    }
}
