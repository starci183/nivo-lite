import type {
    BindingInput,
    PackageInput,
    PackageRequest,
    ParameterBinding,
    ParameterInput,
    ParameterValue,
    TemplateParameter,
} from "../agent-templates.contracts"

/** How the text of a default is read in a parameter of each kind: a number, yes or no, or the text itself. */
const READERS: Readonly<Record<TemplateParameter["kind"], (text: string) => ParameterValue>> = {
    number: Number,
    toggle: (text) => text === "true",
    text: (text) => text,
    textarea: (text) => text,
}

const parameterOf = (input: ParameterInput): TemplateParameter => ({
    key: input.key,
    kind: input.kind,
    label: input.label,
    hint: input.hint ?? null,
    min: input.min ?? null,
    max: input.max ?? null,
    required: input.required,
    default: READERS[input.kind](input.defaultValue),
})

const bindingOf = (input: BindingInput): ParameterBinding =>
    input.target === "branch_timeout"
        ? { parameter: input.parameter, target: "branch_timeout", nodeKey: input.nodeKey, branchKey: input.branchKey }
        : {
              parameter: input.parameter,
              target: "branch_value",
              nodeKey: input.nodeKey,
              branchKey: input.branchKey,
              termIndex: input.termIndex ?? 0,
          }

/** The request of the domain for what the creator typed into the editor of a workspace: defaults filled, texts read in the kind of their parameter. */
export const packageRequestOf = (workspaceId: string, input: PackageInput): PackageRequest => ({
    workspaceId,
    agentId: input.agentId,
    graphVersionId: input.graphVersionId,
    key: input.key,
    listing: { name: input.name, summary: input.summary, points: [], category: input.category },
    parameters: input.parameters.map((parameter) => parameterOf(parameter)),
    bindings: input.bindings.map((binding) => bindingOf(binding)),
    starterDocumentIds: input.starterDocumentIds,
    persona: { soul: input.soul, likeness: input.likeness ?? null },
    requiresPlugins: [],
    changelog: input.changelog,
    breaking: input.breaking,
})
