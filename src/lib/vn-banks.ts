/** Client-safe: the Vietnamese banks a shop owner can pick (short code as providers print it, plus the full name). */
export type VnBank = { readonly code: string; readonly name: string };

export const VN_BANKS: ReadonlyArray<VnBank> = [
  { code: "VCB", name: "Vietcombank" },
  { code: "CTG", name: "VietinBank" },
  { code: "BIDV", name: "BIDV" },
  { code: "AGR", name: "Agribank" },
  { code: "MB", name: "MB Bank" },
  { code: "TCB", name: "Techcombank" },
  { code: "ACB", name: "ACB" },
  { code: "VPB", name: "VPBank" },
  { code: "STB", name: "Sacombank" },
  { code: "TPB", name: "TPBank" },
  { code: "HDB", name: "HDBank" },
  { code: "VIB", name: "VIB" },
  { code: "SHB", name: "SHB" },
  { code: "MSB", name: "MSB" },
  { code: "OCB", name: "OCB" },
  { code: "SEAB", name: "SeABank" },
  { code: "EIB", name: "Eximbank" },
  { code: "LPB", name: "LPBank" },
  { code: "NAB", name: "Nam A Bank" },
  { code: "BAB", name: "Bac A Bank" },
  { code: "ABB", name: "ABBank" },
  { code: "BVB", name: "BaoViet Bank" },
  { code: "VAB", name: "VietABank" },
  { code: "PVCB", name: "PVcomBank" },
  { code: "SCB", name: "SCB" },
  { code: "NCB", name: "NCB" },
  { code: "KLB", name: "KienlongBank" },
  { code: "CAKE", name: "CAKE by VPBank" },
  { code: "UBANK", name: "Ubank by VPBank" },
  { code: "TIMO", name: "Timo" },
];

export const bankName = (code: string): string => VN_BANKS.find((b) => b.code === code)?.name ?? code;
