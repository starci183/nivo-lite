export type {
    DataShape,
    JsonObject,
    JsonSchema,
    JsonValue,
    Namespaced,
    PropsSchema,
    SpecLocale,
    SpecText,
} from "./schema.types"
export { specText } from "./spec-text.schema"
export type { NivoLevel } from "./namespaced"
export {
    isActionId,
    isApiVerb,
    isCrmOp,
    isNamespaced,
    isOperationId,
    isQualifiedAction,
    isQualifiedName,
    isQualifiedRead,
    isReadId,
    isToolId,
    isToolName,
    isTriggerVerb,
    levelOf,
    moduleKeyOfName,
    moduleKeyOfOperation,
    namespaceOf,
    wordsOf,
} from "./namespaced"
