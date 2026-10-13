import type { WizardConnection } from "@modules/domain/channel-connections"
import type { WizardConnectionType } from "./dto/wizard-connection.type"

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

/** The human bank name of a bank code; an unlisted code stays as it is (trimmed, upper case). */
export const bankNameOf = (bankCode: string): string => {
    const code = bankCode.trim().toUpperCase()
    return BANK_NAMES[code] ?? code
}

/** Maps a wizard connection of a bank or payment feed to the GraphQL type, adding the bank display name. */
export const toWizardConnectionType = (connection: WizardConnection): WizardConnectionType => ({
    ...connection,
    bank: bankNameOf(connection.bankCode),
})
