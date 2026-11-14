import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import { chatPageSchema, doorDataSchema } from "./nivo-api-answers.schema"
import type { NivoApiAnswerShaper } from "./nivo-api-ops.contracts"

/** The answer as the handler gave it. */
const asIs: NivoApiAnswerShaper = (result) => result

/** The answer as the member of an object the op declares. */
const member =
    (name: string): NivoApiAnswerShaper =>
    (result) => ({ [name]: result })

/**
 * How each op shapes what its handler answered into its declared output: a list or a value the op names (`{ threads }`), a door's JSON
 * text as data, a thread page as messages and the next cursor. An op that is not listed answers what its handler answered.
 */
const SHAPERS: ReadonlyMap<string, NivoApiAnswerShaper> = new Map([
    [NIVO_API.contact.get, member("detail")],
    [NIVO_API.contact.blockList, member("agents")],
    [NIVO_API.contact.memoryForget, member("forgotten")],
    [NIVO_API.contact.delete, member("deleted")],
    [NIVO_API.file.upload, (result: unknown) => doorDataSchema.parse(result)],
    [NIVO_API.file.confirm, (result: unknown) => doorDataSchema.parse(result)],
    [NIVO_API.file.link, (result: unknown) => doorDataSchema.parse(result)],
    [NIVO_API.file.get, (result: unknown) => doorDataSchema.parse(result)],
    [NIVO_API.file.delete, (result: unknown) => doorDataSchema.parse(result)],
    [NIVO_API.chatThread.list, member("threads")],
    [NIVO_API.chatThread.get, (result: unknown) => chatPageSchema.parse(result)],
    [NIVO_API.workbench.read, (result: unknown) => ({ data: doorDataSchema.parse(result) })],
    [NIVO_API.workbench.action, (result: unknown) => ({ result: doorDataSchema.parse(result) })],
    [NIVO_API.record.typeList, member("modules")],
    [NIVO_API.accountData.typeList, member("types")],
    [NIVO_API.agent.list, member("agents")],
    [NIVO_API.workflow.list, member("workflows")],
    [NIVO_API.run.get, member("run")],
    [NIVO_API.theme.get, member("theme")],
    [NIVO_API.theme.update, member("theme")],
    [NIVO_API.theme.reset, member("reset")],
])

/** The shaper of an op's answer. */
export const answerShaperOf = (name: string): NivoApiAnswerShaper => SHAPERS.get(name) ?? asIs
