import { NIVO_API_TABLE } from "./nivo-api.declarations"
import type {
    NivoApiDispatch,
    NivoApiOpGroup,
    NivoApiOpTable,
    NivoApiRegisteredOp,
} from "./nivo-api-ops.contracts"
import { answerShaperOf } from "./nivo-api-answers.policy"
import { requestBuilderOf } from "./nivo-api-requests.policy"
import { scopeOf } from "./nivo-api-scope.policy"

/**
 * The table of the registered ops from the groups the app lists: each op takes its message from the feature that owns it, and its
 * request, answer and key narrowing from the declarations. The first declaration of a name stands; a name declared twice is reported,
 * and so is an exposed op no group declares (the executor answers it `not_exposed`; the app spec fails on it).
 */
export const nivoApiOpTableOf = (groups: ReadonlyArray<NivoApiOpGroup>): NivoApiOpTable => {
    const declared = new Map(Object.entries(NIVO_API_TABLE))
    const ops = new Map<string, NivoApiRegisteredOp>()
    const duplicated: Array<string> = []
    for (const group of groups) {
        const dispatches: ReadonlyArray<readonly [string, NivoApiDispatch]> = [
            ...Object.entries(group.queries).map(([name, message]): readonly [string, NivoApiDispatch] => [name, { bus: "query", message }]),
            ...Object.entries(group.commands).map(([name, message]): readonly [string, NivoApiDispatch] => [name, { bus: "command", message }]),
        ]
        for (const [name, dispatch] of dispatches) {
            const declaration = declared.get(name)
            const request = requestBuilderOf(name)
            const scope = scopeOf(name)
            if (ops.has(name)) duplicated.push(name)
            else if (declaration?.exposed === true && request !== undefined && scope !== undefined)
                ops.set(name, { scope, readOnly: declaration.readOnly, request, answer: answerShaperOf(name), dispatch })
        }
    }
    const uncovered = [...declared].filter(([name, declaration]) => declaration.exposed && !ops.has(name)).map(([name]) => name)
    return { ops, uncovered, duplicated }
}
