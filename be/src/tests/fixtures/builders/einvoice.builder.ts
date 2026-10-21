/** Builds a TT78 e-invoice XML for the specs; every field can be replaced. */
export const tt78Xml = (overrides: Readonly<Record<string, string>> = {}): string => {
    const value = (key: string, fallback: string): string => overrides[key] ?? fallback
    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- signed by the provider -->
<TDiep><DLieu><HDon><DLHDon Id="data">
  <TTChung><PBan>2.0.1</PBan><KHMSHDon>1</KHMSHDon><KHHDon>C26TLA</KHHDon><SHDon>${value("SHDon", "17")}</SHDon><NLap>2026-10-19</NLap><DVTTe>VND</DVTTe></TTChung>
  <NDHDon>
    <NBan><Ten>${value("SellerTen", "Cong ty TNHH Linh An")}</Ten><MST>${value("SellerMST", "0100109106")}</MST></NBan>
    <NMua><Ten>HAKUEN Hotel &amp; Spa</Ten><MST>${value("BuyerMST", "0108896128")}</MST></NMua>
    <DSHHDVu>
      <HHDVu><STT>1</STT><THHDVu>Khan tam cotton</THHDVu><SLuong>20</SLuong><DGia>100000</DGia><ThTien>2000000</ThTien><TSuat>${value("TSuat1", "10%")}</TSuat></HHDVu>
      <HHDVu><STT>2</STT><THHDVu><![CDATA[Dau massage <thao moc>]]></THHDVu><SLuong>10</SLuong><ThTien>2200000</ThTien><TSuat>KCT</TSuat></HHDVu>
    </DSHHDVu>
    <TToan><TgTCThue>${value("TgTCThue", "4200000")}</TgTCThue><TgTThue>${value("TgTThue", "200000")}</TgTThue><TgTTTBSo>${value("TgTTTBSo", "4400000")}</TgTTTBSo></TToan>
  </NDHDon>
</DLHDon><DSCKS><NBan/></DSCKS></HDon></DLieu></TDiep>`
}
