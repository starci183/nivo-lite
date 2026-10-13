import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DocumentsOptions } from "./documents.options"
import type { DocumentsPort } from "./documents.port"

/** Token of the options of the documents integration, exported so a spec can provide it. */
export const DOCUMENTS_OPTIONS: unique symbol = Symbol("integrations.documents.options")

/** Token of the DocumentsPort. */
export const DOCUMENTS: unique symbol = Symbol("integrations.documents")

/** Injects the options of the documents integration. Parameter type: DocumentsOptions. */
export const InjectDocumentsOptions = (): TypedParameterDecorator<DocumentsOptions> =>
    injector<DocumentsOptions>(DOCUMENTS_OPTIONS)

/** Injects the documents port. Parameter type: DocumentsPort. */
export const InjectDocuments = (): TypedParameterDecorator<DocumentsPort> => injector<DocumentsPort>(DOCUMENTS)
