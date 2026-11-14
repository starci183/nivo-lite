import type { SandboxCasesQuery, SandboxLatestRequestQuery, SandboxNextCasesQuery } from "@/modules/api"
import type { SandboxCasesData, SandboxInputView } from "@/modules/types"
import { SANDBOX_JOIN, type SandboxWords } from "./sandbox.words"

/** One case, its input and the agent's latest request as the back end answers them. */
type CaseWire = SandboxCasesQuery["sandboxCases"][number]
type InputWire = CaseWire["inputs"][number]
type LatestWire = SandboxLatestRequestQuery["sandboxLatestRequest"]

/** The inputs the inbound cases take, each name once in the order the cases give them. */
const inputsOf = (cases: ReadonlyArray<CaseWire>): ReadonlyArray<InputWire> => {
    const inputs = new Map<string, InputWire>()
    for (const one of cases) {
        if (one.direction !== "inbound") continue
        for (const input of one.inputs) if (!inputs.has(input.name)) inputs.set(input.name, input)
    }
    return [...inputs.values()]
}

/** The values of the agent's latest request as the reader reads them: an integer input is written the way numbers are. */
const shownOf = (latest: LatestWire, inputs: ReadonlyArray<InputWire>, words: SandboxWords): ReadonlyArray<string> => {
    const kinds = new Map(inputs.map((input) => [input.name, input.kind]))
    return (latest?.inputs ?? [])
        .map((input) => {
            const asNumber = Number(input.value)
            const isInteger = kinds.get(input.name) === "integer" && input.value !== "" && Number.isFinite(asNumber)
            return isInteger ? words.number(asNumber) : input.value
        })
        .filter((value) => value !== "")
}

/**
 * The cases block of one account: its cases (the next one of each outbound operation marked), the inputs the inbound cases take
 * (each with what the person typed, else what the agent's latest request held), and the lines that say so.
 */
export const casesDataOf = (
    cases: ReadonlyArray<CaseWire>,
    next: SandboxNextCasesQuery["sandboxNextCases"],
    latest: LatestWire,
    edits: Readonly<Record<string, string>>,
    words: SandboxWords,
): SandboxCasesData => {
    const inputs = inputsOf(cases)
    const fields: ReadonlyArray<SandboxInputView> = inputs.map((input) => ({
        name: input.name,
        label: input.label,
        placeholder: input.example,
        value: edits[input.name] ?? latest?.inputs.find((one) => one.name === input.name)?.value ?? "",
    }))
    const shown = shownOf(latest, inputs, words)
    return {
        rows: cases.map((one) => ({
            id: one.id,
            label: one.label,
            direction: one.direction === "inbound" ? "inbound" : "outbound",
            operation: one.operation ?? null,
            isDefault: one.isDefault,
            isNext:
                one.direction !== "inbound" &&
                next.some((entry) => entry.operation === one.operation && entry.caseId === one.id),
        })),
        fields,
        latestLine: shown.length === 0 ? null : words.latest(shown.join(SANDBOX_JOIN)),
        nextLines: next.map((entry) => words.next(entry.operation, entry.caseId)),
    }
}
