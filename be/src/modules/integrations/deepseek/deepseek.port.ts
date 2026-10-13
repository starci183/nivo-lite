import type { TextRequest } from "./deepseek.contracts"

/** The one door to the text AI: the app root binds it to the agents capability, which runs the request on OpenClaw. */
export interface DeepseekTextGenerator {
    /** Runs a prompt and answers the text; fails with a typed error when the model cannot answer. */
    generate(request: TextRequest): Promise<string>
}
