import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { InvoiceIssuePort } from "./invoice-ports.contracts"
import type { SpeechPort } from "./media-ports.contracts"
import {
    DubbingRegistryService,
    InvoiceIssueRegistryService,
    ProviderFileRegistryService,
    PURPOSE_REGISTRIES,
    SpeechRegistryService,
    VideoGenerationRegistryService,
} from "./media-registries.service"

describe("the registries of the media and invoice purposes", () => {
    it("are the five the registry module provides, each its own class", () => {
        expect(PURPOSE_REGISTRIES).toEqual([
            SpeechRegistryService,
            DubbingRegistryService,
            VideoGenerationRegistryService,
            ProviderFileRegistryService,
            InvoiceIssueRegistryService,
        ])
    })

    it("keep the registrations of one purpose apart from the others", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [...PURPOSE_REGISTRIES] }).compile()
        const speech = moduleRef.get(SpeechRegistryService)
        const invoices = moduleRef.get(InvoiceIssueRegistryService)
        const port = mock<SpeechPort>({ provider: "elevenlabs" })

        speech.register(port)

        expect(speech.liveOf("elevenlabs")).toBe(port)
        expect(invoices.has("elevenlabs")).toBe(false)
        expect(invoices.providers()).toEqual([])
    })

    it("replaces a registration made twice under one key", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [InvoiceIssueRegistryService] }).compile()
        const invoices = moduleRef.get(InvoiceIssueRegistryService)
        const first = mock<InvoiceIssuePort>({ provider: "misa" })
        const second = mock<InvoiceIssuePort>({ provider: "misa" })

        invoices.register(first)
        invoices.register(second)

        expect(invoices.liveOf("misa")).toBe(second)
    })
})
