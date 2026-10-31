/**
 * The words of the rule pack vn-llc-64@1 that people read, written in Vietnamese as the dossiers are: the legal bases of each dossier
 * by its reference, the label of each expectation, and the document that completes a gap with the guidance NIVO drafts it from.
 */
export const DOSSIER_PACK_WORDS = {
    /** The legal bases of each dossier, by reference, from the "Căn cứ" column of the final legal review. */
    basis: {
        "1": ["LDN 59/2020 (sđ 76/2025) Đ.27-31", "NĐ 168/2025 (sđ NĐ 296/2026)"],
        "2": ["LDN 59/2020 (sđ 76/2025) Đ.24, 25"],
        "3": ["LDN Đ.43"],
        "4": ["Luật GDĐT 20/2023"],
        "5": ["LDN; quy định mở tài khoản ngân hàng"],
        "6": ["LDN Đ.12, 13", "NĐ 168/2025"],
        "7": ["Luật Kế toán Đ.41", "Luật QLT 108/2025"],
        "8": ["LDN Đ.48"],
        "9": ["NĐ 168/2025"],
        "10": ["LDN Đ.47"],
        "11": ["LDN Đ.47", "Luật Kế toán"],
        "12": ["LDN Đ.47 khoản 6"],
        "13": ["BLDS 2015"],
        "14": ["LDN Đ.58"],
        "15": ["LDN Đ.58"],
        "16": ["LDN Đ.58"],
        "17": ["LDN Đ.58"],
        "18": ["LDN Đ.59, 61"],
        "19": ["LDN Đ.60"],
        "20": ["LDN Đ.55, 59"],
        "21": ["LDN Đ.56"],
        "22": ["LDN Đ.56, 57"],
        BKS: ["LDN Đ.54"],
        "23": ["LDN Đ.63", "Điều lệ"],
        "24": ["BLLĐ 2019 Đ.118, 119"],
        "25": ["BLLĐ Đ.93", "NĐ 293/2025"],
        "26": ["BLLĐ Đ.104"],
        "28": ["BLLĐ Đ.13-14"],
        "29": ["BLLĐ Đ.12", "NĐ 145/2020 Đ.3, 4"],
        "30": ["Luật BHXH 41/2024 Đ.2.1(i)"],
        "31": ["LDN", "Điều lệ"],
        "34": ["BLDS Đ.135-143"],
        "35": ["Luật TNDN 67/2025", "NĐ 320/2025"],
        "36": ["BLDS", "Luật Thương mại"],
        "37": ["BLLĐ Đ.21"],
        "38": ["Luật BVDLCN 91/2025", "NĐ 356/2025"],
        "42": ["Luật Kế toán"],
        "44": ["NĐ 254/2026", "Luật Kế toán"],
        "45": ["Luật Kế toán 88/2015 (sđ 56/2024)", "TT 133/2016"],
        "46": ["TT 133/2016", "TT 58/2026"],
        "47": ["Luật QLT 108/2025", "Luật TNCN 109/2025"],
        "48": ["LDN Đ.4 khoản 23, Đ.67"],
        "49": ["LDN Đ.67"],
        "50": ["NĐ 168/2025 Đ.17-18, 52 (sđ NĐ 296/2026)"],
        "51": ["NĐ 168/2025"],
        "52": ["Luật SHTT (sđ 131/2025)"],
        "53": ["Luật Viễn thông 24/2023"],
        "54": ["Luật SHTT", "TT 08/2026/TT-BVHTTDL"],
        "55": ["Luật BVDLCN 91/2025"],
        "56": ["Luật BVDLCN 91/2025", "NĐ 356/2025"],
        "57": ["Luật BVDLCN Đ.21, 22, 38"],
    },
    /** What each expectation is, for people, by its key. */
    labels: {
        registration_certificate: "giấy chứng nhận đăng ký doanh nghiệp",
        change_dossier: "bộ hồ sơ đã nộp cho lần thay đổi gần nhất",
        charter: "điều lệ đã ký",
        seal_decision: "quyết định quản lý và sử dụng con dấu",
        certificate_register: "sổ theo dõi chứng thư chữ ký số",
        bank_accounts: "hồ sơ tài khoản ngân hàng",
        legal_representative_id: "CCCD của người đại diện theo pháp luật",
        members_register: "sổ đăng ký thành viên",
        contribution_minutes: "biên bản góp vốn",
        contribution_vouchers: "chứng từ góp vốn",
        capital_certificates: "giấy chứng nhận phần vốn góp",
        council_minutes: "biên bản họp Hội đồng thành viên",
        council_resolutions: "nghị quyết Hội đồng thành viên",
        chair_election: "hồ sơ bầu Chủ tịch Hội đồng thành viên",
        appointments: "quyết định bổ nhiệm",
        labour_contracts: "hợp đồng lao động",
        staff_ids: "CCCD của người lao động",
        nda: "thỏa thuận bảo mật",
        domain_register: "sổ theo dõi tên miền",
    },
    /** The document that completes a gap of a dossier and what NIVO drafts it from, by reference. */
    remedies: {
        "1": {
            documentType: "Hồ sơ đăng ký thay đổi doanh nghiệp",
            guidance: "Lưu bộ hồ sơ đã nộp cho cơ quan đăng ký kinh doanh ở mỗi lần thay đổi.",
        },
        "2": {
            documentType: "Nghị quyết HĐTV thông qua Điều lệ sửa đổi",
            guidance:
                "Nghị quyết của Hội đồng thành viên thông qua Điều lệ sửa đổi theo thành viên và vốn hiện tại, kèm Điều lệ sửa đổi.",
        },
        "3": {
            documentType: "Quyết định quản lý và sử dụng con dấu",
            guidance:
                "Quyết định của người đại diện theo pháp luật về số lượng, hình thức, quản lý và sử dụng con dấu.",
        },
        "5": {
            documentType: "Giấy đề nghị thay đổi người phụ trách kế toán",
            guidance: "Đề nghị ngân hàng cập nhật người phụ trách kế toán theo quyết định giao nhiệm vụ mới nhất.",
        },
        "6": {
            documentType: "CCCD của người đại diện theo pháp luật",
            guidance: "Bản scan căn cước công dân còn hiệu lực của người đại diện theo pháp luật.",
        },
        "8": {
            documentType: "Sổ đăng ký thành viên",
            guidance: "Sổ ghi tên, địa chỉ, phần vốn góp, tỷ lệ và thời điểm góp của từng thành viên (LDN Đ.48).",
        },
        "10": {
            documentType: "Biên bản góp vốn",
            guidance: "Biên bản xác nhận số vốn từng thành viên đã góp, tài sản góp và thời điểm góp.",
        },
        "11": {
            documentType: "Chứng từ góp vốn",
            guidance: "Sao kê hoặc chứng từ chuyển tiền góp vốn vào tài khoản của công ty.",
        },
        "12": {
            documentType: "Giấy chứng nhận phần vốn góp",
            guidance: "Giấy chứng nhận cho từng thành viên đã góp đủ phần vốn (LDN Đ.47 khoản 6).",
        },
        "19": {
            documentType: "Biên bản và Nghị quyết HĐTV",
            guidance: "Biên bản họp và nghị quyết của Hội đồng thành viên ghi nhận sự kiện còn chưa được thông qua.",
        },
        "20": {
            documentType: "Biên bản và Nghị quyết HĐTV",
            guidance: "Biên bản họp và nghị quyết của Hội đồng thành viên ghi nhận sự kiện còn chưa được thông qua.",
        },
        "21": {
            documentType: "Nghị quyết bầu Chủ tịch HĐTV",
            guidance: "Nghị quyết của Hội đồng thành viên bầu Chủ tịch Hội đồng thành viên và nhiệm kỳ.",
        },
        "23": {
            documentType: "Quyết định bổ nhiệm",
            guidance: "Quyết định bổ nhiệm người giữ chức danh còn thiếu, ghi ngày hiệu lực.",
        },
        "29": {
            documentType: "CCCD của người lao động",
            guidance: "Bản scan căn cước công dân của từng người lao động đang làm việc.",
        },
        "37": {
            documentType: "Thỏa thuận bảo mật",
            guidance: "Thỏa thuận bảo mật thông tin giữa công ty và từng người lao động hiện tại.",
        },
    },
} as const
