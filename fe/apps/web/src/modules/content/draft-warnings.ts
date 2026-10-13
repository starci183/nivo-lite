import type { ContentAiWarningType } from "@/modules/api"
import type { ChannelWarning } from "./claims"
import { isContentChannel } from "./types"

/** Maps the generated review findings into the editor's display vocabulary. */
export const toContentDraftWarnings = (warnings: ReadonlyArray<ContentAiWarningType>): Array<ChannelWarning> =>
    warnings.flatMap(({ channel, warning }): Array<ChannelWarning> => {
        if (!isContentChannel(channel)) return []
        if (warning.kind === "promise" && warning.phrase != null)
            return [{ channel, warning: { kind: "promise", phrase: warning.phrase } }]
        if (warning.kind === "figure" && warning.figure != null)
            return [{ channel, warning: { kind: "figure", figure: warning.figure } }]
        if (warning.kind === "length" && warning.length != null && warning.max != null)
            return [{ channel, warning: { kind: "length", length: warning.length, max: warning.max } }]
        return []
    })
