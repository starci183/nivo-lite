import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"

@Injectable()
/** Reads the JSON a model wrapped in prose or a markdown fence: the first object or list that parses. */
export class ModelJsonService {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** The parsed JSON of an answer, or null when no object or list in it parses. */
    jsonOf(answer: string): unknown {
        const body = answer.replace(/```(?:json)?/gi, "")
        const object = [body.indexOf("{"), body.lastIndexOf("}")] as const
        const list = [body.indexOf("["), body.lastIndexOf("]")] as const
        const tries = list[0] >= 0 && (object[0] < 0 || list[0] < object[0]) ? [list, object] : [object, list]
        for (const [from, to] of tries) {
            if (from < 0 || to <= from) continue
            try {
                return JSON.parse(body.slice(from, to + 1))
            } catch (cause) {
                this.logger.error(BrainLogEvent.AnswerUnreadable, cause)
            }
        }
        return null
    }
}
