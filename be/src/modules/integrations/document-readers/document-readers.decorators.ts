import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DocumentLibraries } from "./document-readers.contracts"
import type { DocumentReadersPort } from "./document-readers.port"

/** Token of the document readers port. */
export const DOCUMENT_READERS: unique symbol = Symbol("integrations.document-readers.port")

/** Token of the libraries behind the readers, exported so a spec can provide scripted ones. */
export const DOCUMENT_LIBRARIES: unique symbol = Symbol("integrations.document-readers.libraries")

/** Injects the document readers port. Parameter type: DocumentReadersPort. */
export const InjectDocumentReaders = (): TypedParameterDecorator<DocumentReadersPort> =>
    injector<DocumentReadersPort>(DOCUMENT_READERS)

/** Injects the libraries behind the readers. Parameter type: DocumentLibraries. */
export const InjectDocumentLibraries = (): TypedParameterDecorator<DocumentLibraries> =>
    injector<DocumentLibraries>(DOCUMENT_LIBRARIES)
