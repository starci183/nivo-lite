import type { ProviderSandboxService, SandboxAccount } from "@modules/domain/provider-sandbox"
import { SEPAY_SANDBOX_CATALOGUE } from "@modules/domain/sepay-provider/sepay-sandbox.catalogue"

/**
 * Sends five SePay cases to a sandbox account through the real frame (what the one send does before it posts), so the poll and the list
 * have movements to read back: 9100001 SEPAY-1 in 350,000 (02:15:02Z), 9100002 SEPAY-2 in 499,000 (02:40:18Z), 9100003 SEPAY-4 in
 * 200,000 no content (03:05:44Z), 9100004 SEPAY-5 out 80,000 (03:30:09Z), 9100005 SEPAY-6 in 450,000 posted twice (04:12:51Z).
 */
export const seedSepayMovements = async (sandbox: ProviderSandboxService, account: SandboxAccount): Promise<void> => {
    const sends: ReadonlyArray<readonly [string, string, number, string]> = [
        ["SEPAY-1", "NIVO DH1001", 350_000, "2026-11-14T02:15:02.000Z"],
        ["SEPAY-2", "NIVO DH1002", 500_000, "2026-11-14T02:40:18.000Z"],
        ["SEPAY-4", "", 200_000, "2026-11-14T03:05:44.000Z"],
        ["SEPAY-5", "hoan tien", 80_000, "2026-11-14T03:30:09.000Z"],
        ["SEPAY-6", "NIVO DH1003", 450_000, "2026-11-14T04:12:51.000Z"],
    ]
    for (const [caseId, content, amount, at] of sends) {
        const inbound = SEPAY_SANDBOX_CATALOGUE.cases.find((one) => one.id === caseId)?.inbound
        if (inbound === undefined) throw new Error(`no case ${caseId}`)
        // eslint-disable-next-line no-await-in-loop
        await sandbox.inbound(account, caseId, inbound, { content, amount }, new Date(at))
    }
}
