import { mock } from "@starci/jest-preset"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { BusinessLedgerEntry, LedgerPort } from "@modules/domain/provider-registry"
import { MisaAmisClient } from "@modules/integrations/misa-amis"
import { MisaAmisLedgerService } from "./misa-amis-ledger.service"

/**
 * The ONE tool contract of the ledger purpose (`nivo.tool.ledger.entry.append` / `.void`), met by every owner: a port keyed by its
 * provider, `ready` a boolean, a write answering the provider's reference (or undefined when nothing is connected), and a failed
 * write carrying what it proves. Google's own behaviour is proved in `google-ledger.service.spec.ts`; here each owner is held to the
 * same shape, the Google sheet by a double of its contract and MISA AMIS by its real adapter (docs-missing: never ready, refused
 * `not_available` before anything leaves).
 */
const ENTRY: BusinessLedgerEntry = {
    date: "2026-11-04",
    orderNo: "DH-7",
    customer: "Dinh",
    amountVnd: 5000,
    transactionId: "sepay:1",
    status: "paid",
    note: "",
}

interface Owner {
    readonly name: string
    readonly port: LedgerPort
    readonly ready: boolean
    readonly writeProof: "not_sent" | "unknown" | null
}

const googleDouble = (): LedgerPort => {
    const port = mock<LedgerPort>({ provider: "google" })
    port.ready.mockResolvedValue(true)
    port.append.mockResolvedValue("Sheet1!A2:H2")
    port.void.mockResolvedValue("Sheet1!A3:H3")
    return port
}

const OWNERS: ReadonlyArray<Owner> = [
    { name: "google (the sheet)", port: googleDouble(), ready: true, writeProof: null },
    { name: "misa_amis (docs-missing)", port: new MisaAmisLedgerService(new MisaAmisClient()), ready: false, writeProof: "not_sent" },
]

describe.each(OWNERS)("the ledger contract, owner $name", ({ port, ready, writeProof }) => {
    it("is keyed by a provider key", () => {
        expect(port.provider).toMatch(/^[a-z][a-z0-9_]*$/u)
    })

    it("answers ready as a boolean", async () => {
        await expect(port.ready("ws-1")).resolves.toBe(ready)
    })

    it.each([
        ["append", (owner: LedgerPort) => owner.append("ws-1", ENTRY, "conn-1")],
        ["void", (owner: LedgerPort) => owner.void("ws-1", "sepay:1", "conn-1")],
    ] as const)("answers a %s with a reference, or fails with what it proves", async (_write, write) => {
        const outcome = await write(port).then(
            (ref) => ({ ref }),
            (cause: unknown) => ({ cause }),
        )
        if (writeProof === null) {
            expect(outcome).toEqual({ ref: expect.any(String) })
        } else {
            expect("cause" in outcome && proofOf(outcome.cause)).toBe(writeProof)
            expect(outcome).toMatchObject({ cause: { code: ProviderRegistryErrorCode.RefusedNotAvailable, params: { provider: "misa_amis" } } })
        }
    })
})
