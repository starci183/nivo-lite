import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type {
    AutomationGate,
    AutomationOffice,
    AutomationOwnerChat,
    AutomationRecords,
    AutomationText,
} from "./automation-ports.contracts"

/** Token of the authority gate every customer message goes through. */
export const AUTOMATION_GATE: unique symbol = Symbol("domain.automations.gate")
/** Token of the Office port (its line, its tasks, its evidence log). */
export const AUTOMATION_OFFICE: unique symbol = Symbol("domain.automations.office")
/** Token of the port that creates or changes records of other capabilities. */
export const AUTOMATION_RECORDS: unique symbol = Symbol("domain.automations.records")
/** Token of the text generator; absent means every message keeps its deterministic wording. */
export const AUTOMATION_TEXT: unique symbol = Symbol("domain.automations.text")
/** Token of the owner's chat; absent means the day report stays in Office. */
export const AUTOMATION_OWNER_CHAT: unique symbol = Symbol("domain.automations.owner-chat")

/** Injects the authority gate. Parameter type: AutomationGate. */
export const InjectAutomationGate = (): TypedParameterDecorator<AutomationGate> =>
    injector<AutomationGate>(AUTOMATION_GATE)

/** Injects the Office port. Parameter type: AutomationOffice. */
export const InjectAutomationOffice = (): TypedParameterDecorator<AutomationOffice> =>
    injector<AutomationOffice>(AUTOMATION_OFFICE)

/** Injects the records port. Parameter type: AutomationRecords. */
export const InjectAutomationRecords = (): TypedParameterDecorator<AutomationRecords> =>
    injector<AutomationRecords>(AUTOMATION_RECORDS)

/** Injects the text generator. Parameter type: AutomationText. */
export const InjectAutomationText = (): TypedParameterDecorator<AutomationText> =>
    injector<AutomationText>(AUTOMATION_TEXT)

/** Injects the owner's chat. Parameter type: AutomationOwnerChat. */
export const InjectAutomationOwnerChat = (): TypedParameterDecorator<AutomationOwnerChat> =>
    injector<AutomationOwnerChat>(AUTOMATION_OWNER_CHAT)
