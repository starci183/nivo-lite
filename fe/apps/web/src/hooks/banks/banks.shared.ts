/** The Vietnamese banks a shop owner can pick, by the short code providers print (their names are the `banks` catalog). */
export const VN_BANK_CODES: ReadonlyArray<string> = [
    "VCB",
    "CTG",
    "BIDV",
    "AGR",
    "MB",
    "TCB",
    "ACB",
    "VPB",
    "STB",
    "TPB",
    "HDB",
    "VIB",
    "SHB",
    "MSB",
    "OCB",
    "SEAB",
    "EIB",
    "LPB",
    "NAB",
    "BAB",
    "ABB",
    "BVB",
    "VAB",
    "PVCB",
    "SCB",
    "NCB",
    "KLB",
    "CAKE",
    "UBANK",
    "TIMO",
]

/** Whether NIVO lists this bank code. */
export const isListedBank = (code: string): boolean => VN_BANK_CODES.includes(code)

/** The bank's logo (public/logos/banks/<code>.png, from VietQR's bank list), or null for a code NIVO does not list. */
export const bankLogo = (code: string): string | null => (isListedBank(code) ? `/logos/banks/${code}.png` : null)

/**
 * The workspace's bank connection. SIMULATED: there is no real bank integration yet; credits arrive through the back end bank
 * webhook and are always stored with origin "simulated".
 */
export const BANK_CONNECTION = {
    key: "vietcombank",
    name: "Vietcombank",
    account: "•••• 6789 · SPA HOA MAI",
    simulated: true,
} as const

/** The connection a stored inbound event came from (by its event id prefix), or null. */
export const bankConnectionOf = (
    event: { readonly channel?: string | null; readonly event_id?: string | null } | null | undefined,
) => (event?.channel === "bank" && event.event_id?.startsWith(`${BANK_CONNECTION.key}:`) ? BANK_CONNECTION : null)
