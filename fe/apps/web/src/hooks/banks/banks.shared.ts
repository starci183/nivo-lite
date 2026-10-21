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
