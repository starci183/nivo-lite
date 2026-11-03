import { builder } from "@starci/jest-preset"
import { automationTemplatesEntities } from "@modules/domain/automation-templates"

const AutomationTemplateEntity: (typeof automationTemplatesEntities)[0] = automationTemplatesEntities[0]
type AutomationTemplateEntity = InstanceType<typeof AutomationTemplateEntity>

const text = { vi: "Hello there", en: "Hello" }

type DefinitionOfResultDefaultsShape = {}

type DefinitionOfResultAuthorityShape = {
    action: null
}

type DefinitionOfResultRequiresShape = {
    modules: Array<never>
    channels: Array<never>
    connections: Array<never>
    capabilities: Array<never>
}

type DefinitionOfResultTriggerLineShape = {
    vi: string
    en: string
}

type DefinitionOfResultTriggerShape = {
    kind: string
    event: string
    line: DefinitionOfResultTriggerLineShape
}

type DefinitionOfResultShape = {
    key: string
    version: number
    position: number
    pack: string
    executor: string
    moduleKey: string
    icon: string
    name: DefinitionOfResultTriggerLineShape
    description: DefinitionOfResultTriggerLineShape
    trigger: DefinitionOfResultTriggerShape
    requires: DefinitionOfResultRequiresShape
    settings: Array<never>
    contentMode: string
    guardrails: Array<never>
    variables: Array<never>
    defaultBody: null
    authority: DefinitionOfResultAuthorityShape
    defaults: DefinitionOfResultDefaultsShape
}

/** A catalogue definition of a payment-received template at the given position. */
export const definitionOf = (key: string, position: number): DefinitionOfResultShape => ({
    key,
    version: 2,
    position,
    pack: "core",
    executor: "implemented",
    moduleKey: "sales",
    icon: "payment",
    name: text,
    description: text,
    trigger: { kind: "event", event: "payment.received", line: text },
    requires: { modules: [], channels: [], connections: [], capabilities: [] },
    settings: [],
    contentMode: "none",
    guardrails: [],
    variables: [],
    defaultBody: null,
    authority: { action: null },
    defaults: {},
})

/** A stored template row with the fields a spec rarely changes filled. */
export const rowOf: (overrides?: Partial<AutomationTemplateEntity>) => AutomationTemplateEntity = builder<
    InstanceType<typeof AutomationTemplateEntity>
>({
    key: "a_one",
    version: 1,
    moduleKey: null,
    pack: "core",
    executor: "implemented",
    definition: {},
    updatedAt: new Date("2026-10-12T10:00:00Z"),
    position: 0,
    createdAt: new Date("2026-10-12T10:00:00Z"),
})

/** The stored row of template `a_one` with a valid definition. */
export const storedTemplateAOne = (): InstanceType<typeof AutomationTemplateEntity> =>
    rowOf({ key: "a_one", definition: definitionOf("a_one", 1) })

/** A stored row whose definition is not a template. */
export const invalidTemplateRow = (): InstanceType<typeof AutomationTemplateEntity> =>
    rowOf({ key: "bad", definition: {} })
