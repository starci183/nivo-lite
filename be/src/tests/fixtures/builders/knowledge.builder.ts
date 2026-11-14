import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import mammoth from "mammoth"
import { mock } from "@starci/jest-preset"
import {
    DOCUMENT_LIBRARIES,
    DocumentReadersClient,
    type DocumentLibraries,
    type DocumentReadOutcome,
} from "@modules/integrations/document-readers"

/** The folder of the sample documents the readers are tried on (a workbook, Word files, a picture). */
const FIXTURES = join(__dirname, "..", "..", "..", "modules", "integrations", "document-readers", "fixtures")

/** The bytes of one sample document of the readers. */
export const documentFixtureBytes = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)))

/** What the readers make of one sample document, with the Word library for real; nothing here is a PDF or a picture. */
export const readDocumentFixture = async (name: string): Promise<DocumentReadOutcome> => {
    const libraries = mock<DocumentLibraries>()
    libraries.wordToHtml.mockImplementation(async (bytes) => (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value)
    const moduleRef = await Test.createTestingModule({
        providers: [DocumentReadersClient, { provide: DOCUMENT_LIBRARIES, useValue: libraries }],
    }).compile()
    return moduleRef.get(DocumentReadersClient).read({ name, mime: "", bytes: documentFixtureBytes(name) }, { transcriber: null })
}
