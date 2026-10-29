import { builder } from "@starci/jest-preset"
import { automationTemplatesEntities } from "@modules/domain/automation-templates"

const [AutomationTemplateEntity] = automationTemplatesEntities

const text = { vi: "Hello there", en: "Hello" }

/** A catalogue definition of a payment-received template at the given position. */
export const definitionOf = (key: string, position: number) => ({
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
export const rowOf = builder<InstanceType<typeof AutomationTemplateEntity>>({
    key: "a_one",
    version: 1,
    moduleKey: null,
    pack: "core",
    executor: "implemented",
    definition: {},
    updatedAt: new Date("2026-10-12T10:00:00Z"),
    position: 0,
})

/** The stored row of template `a_one` with a valid definition. */
export const storedTemplateAOne = (): InstanceType<typeof AutomationTemplateEntity> =>
    rowOf({ key: "a_one", definition: definitionOf("a_one", 1) })

/** A stored row whose definition is not a template. */
export const invalidTemplateRow = (): InstanceType<typeof AutomationTemplateEntity> =>
    rowOf({ key: "bad", definition: {} })
