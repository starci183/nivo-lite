import { Injectable } from "@nestjs/common"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import { BrainLogEvent } from "./brain.log-events"

/** Which slice of an answer a parse tried: the first object, or the first list. */
type Slice = "object" | "list"

@Injectable()
/**
 * Reads the JSON a model wrapped in prose or a markdown fence: the first object or list that parses. A call that asked the API for
 * structured output (`AiChatRequest.outputSchema`) gets bare JSON and its first slice parses; this reading stays for every provider
 * that has no structured output (the OpenAI-compatible route, DeepSeek via OpenRouter).
 *
 * Logging is per ANSWER: a slice that does not parse while another one does is a retry (`AnswerSliceRetried`, info, the slice kind
 * only); only an answer with no slice that parses is `AnswerUnreadable` (warn, ONE event, the answer's length and the slices tried).
 * Neither ever carries the answer's text (it may quote a tenant's document).
 */
export class ModelJsonService {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** The parsed JSON of an answer, or null when no object or list in it parses; `workspaceId` names whose call it was in the log (TRIAGE-6). */
    jsonOf(answer: string, workspaceId: string | null = null): unknown {
        const body = answer.replaceAll(/```(?:json)?/gi, "")
        const object = [body.indexOf("{"), body.lastIndexOf("}")] as const
        const list = [body.indexOf("["), body.lastIndexOf("]")] as const
        const tries: ReadonlyArray<readonly [Slice, number, number]> =
            list[0] >= 0 && (object[0] < 0 || list[0] < object[0])
                ? [["list", ...list], ["object", ...object]]
                : [["object", ...object], ["list", ...list]]
        const failed: Array<Slice> = []
        for (const [slice, from, to] of tries) {
            if (from < 0 || to <= from) continue
            const read = parseJsonText(body.slice(from, to + 1))
            if (!read.ok) {
                failed.push(slice)
                continue
            }
            if (failed.length > 0) this.logger.info(BrainLogEvent.AnswerSliceRetried, { workspaceId, failed: failed.join(","), parsed: slice })
            return read.value
        }
        this.logger.warn(BrainLogEvent.AnswerUnreadable, { workspaceId, chars: answer.length, slicesTried: failed.length })
        return null
    }
}
