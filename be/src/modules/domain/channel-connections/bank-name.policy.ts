/** The display names of the Vietnamese banks a shop owner can pick, by the short code providers print. */
const BANK_NAMES: Readonly<Record<string, string>> = {
    VCB: "Vietcombank",
    CTG: "VietinBank",
    BIDV: "BIDV",
    AGR: "Agribank",
    MB: "MB Bank",
    TCB: "Techcombank",
    ACB: "ACB",
    VPB: "VPBank",
    STB: "Sacombank",
    TPB: "TPBank",
    HDB: "HDBank",
    VIB: "VIB",
    SHB: "SHB",
    MSB: "MSB",
    OCB: "OCB",
    SEAB: "SeABank",
    EIB: "Eximbank",
    LPB: "LPBank",
    NAB: "Nam A Bank",
    BAB: "Bac A Bank",
    ABB: "ABBank",
    BVB: "BaoViet Bank",
    VAB: "VietABank",
    PVCB: "PVcomBank",
    SCB: "SCB",
    NCB: "NCB",
    KLB: "KienlongBank",
    CAKE: "CAKE by VPBank",
    UBANK: "Ubank by VPBank",
    TIMO: "Timo",
}

/**
 * The other spellings a provider prints for a listed bank, by the key `keyOf` makes: SePay's own codes and its short names
 * (`qr.sepay.vn/banks.json`: code `ICB` short name `VietinBank`, code `MB` short name `MBBank`, `VBA` `Agribank`, ...), which SePay
 * also reports upper-cased as the bank of a transaction (`MBBANK`).
 */
const ALIASES: Readonly<Record<string, string>> = {
    ICB: "CTG",
    VIETINBANK: "CTG",
    VIETCOMBANK: "VCB",
    MBBANK: "MB",
    VBA: "AGR",
    AGRIBANK: "AGR",
    TECHCOMBANK: "TCB",
    VPBANK: "VPB",
    SACOMBANK: "STB",
    TPBANK: "TPB",
    HDBANK: "HDB",
    SEABANK: "SEAB",
    EXIMBANK: "EIB",
    LPBANK: "LPB",
    LIENVIETPOSTBANK: "LPB",
    NAMABANK: "NAB",
    BACABANK: "BAB",
    ABBANK: "ABB",
    BAOVIETBANK: "BVB",
    VIETABANK: "VAB",
    PVCOMBANK: "PVCB",
    KIENLONGBANK: "KLB",
}

/** The lookup key of a bank spelling: upper case, without spaces, dashes, dots or underscores. */
const keyOf = (spelling: string): string => spelling.toUpperCase().replaceAll(/[\s._-]+/gu, "")

/**
 * The human bank name of a bank code or of a provider's spelling of it (`MBBANK`, `MBBank` and `MB` all read "MB Bank"); an unlisted
 * code stays as it is (trimmed, upper case).
 */
export const bankDisplayNameOf = (bankCode: string): string => {
    const code = bankCode.trim().toUpperCase()
    const key = keyOf(code)
    return BANK_NAMES[key] ?? BANK_NAMES[ALIASES[key] ?? ""] ?? code
}

/** The banks a shop owner can pick, by code with their display name, in the order NIVO lists them (the picker's options). */
export const LISTED_BANKS: ReadonlyArray<{ readonly code: string; readonly name: string }> = Object.entries(BANK_NAMES).map(
    ([code, name]) => ({ code, name }),
)
