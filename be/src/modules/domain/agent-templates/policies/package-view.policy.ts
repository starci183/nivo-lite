import type {
    PackagePreview,
    PackagePreviewView,
    ParameterBinding,
    ParameterView,
    SuggestionView,
    TemplateParameter,
} from "../agent-templates.contracts"

/** One setting the way the editor shows it: the default as text. */
export const parameterViewOf = (parameter: TemplateParameter): ParameterView => ({
    key: parameter.key,
    kind: parameter.kind,
    label: parameter.label,
    hint: parameter.hint,
    min: parameter.min,
    max: parameter.max,
    required: parameter.required,
    defaultValue: String(parameter.default),
})

const suggestionOf = (binding: ParameterBinding): SuggestionView => ({
    parameter: binding.parameter,
    target: binding.target,
    nodeKey: binding.nodeKey,
    branchKey: binding.branchKey,
    termIndex: binding.target === "branch_value" ? binding.termIndex : null,
})

/** What the editor reads of a preview of packaging: counts for the documents, the settings with their defaults as text, the person's name. */
export const previewViewOf = (preview: PackagePreview): PackagePreviewView => ({
    package:
        preview.package === null
            ? null
            : {
                  key: preview.package.key,
                  version: preview.package.version,
                  hash: preview.package.hash,
                  baseModule: preview.package.baseModule,
                  requiredProviders: [...preview.package.requiredProviders],
                  requiredAuthorityActions: [...preview.package.requiredAuthorityActions],
                  starterKnowledge: preview.package.starterKnowledge.length,
                  parameters: preview.package.parameters.map((parameter) => parameterViewOf(parameter)),
                  proposedRights: preview.package.proposedRights.map((right) => ({
                      kind: right.kind,
                      scope: right.scope,
                  })),
                  personName: preview.package.persona.likeness?.personName ?? null,
              },
    report: preview.report,
    problems: [...preview.problems],
    suggestions: preview.suggestions.map((binding) => suggestionOf(binding)),
})
