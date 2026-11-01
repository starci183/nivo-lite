import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the dossier-review codes, the title and detail of every rule finding, and the tail of a NIVO draft; Vietnamese and English. */
export const DOSSIER_REVIEW_MESSAGES: MessageBundle = {
    vi: {
        "unfiled.label": "các tài liệu chưa xếp hồ sơ",
        "errors.DOSSIER_REVIEW_FINDING_NOT_FOUND": "Không tìm thấy phát hiện này trong không gian làm việc.",
        "errors.DOSSIER_REVIEW_DRAFT_NOT_FOUND": "Không tìm thấy dự thảo này trong không gian làm việc.",
        "errors.DOSSIER_REVIEW_TRANSITION_REFUSED":
            "Phát hiện hoặc dự thảo không còn ở trạng thái cho phép thao tác này.",
        "errors.DOSSIER_REVIEW_REASON_REQUIRED": "Cần ghi lý do hoặc nội dung đã làm, từ 3 đến 500 ký tự.",
        "errors.DOSSIER_REVIEW_ASSIGNEE_NOT_MEMBER":
            "Người được giao không phải thành viên đang hoạt động của không gian làm việc.",
        "errors.DOSSIER_REVIEW_DRAFT_DAILY_LIMIT": "Hôm nay đã yêu cầu đủ số dự thảo cho phép. Thử lại vào ngày mai.",
        "errors.DOSSIER_REVIEW_NOTHING_TO_REVIEW": "Không có hồ sơ nào để rà soát. Hãy nhập bảng đối chiếu trước.",
        "errors.DOSSIER_REVIEW_MODEL_UNAVAILABLE": "NIVO chưa đọc được hồ sơ lúc này. Hệ thống sẽ thử lại.",
        "errors.DOSSIER_REVIEW_PAGE_INVALID": "Trang danh sách không hợp lệ. Tải lại danh sách từ đầu.",
        "findings.presence_expected.title": "Hồ sơ {{dossier}} thiếu {{expectation}}",
        "findings.presence_expected.detail":
            "Chưa thấy tài liệu nào của hồ sơ {{dossier}} là {{expectation}}. Tải bản đã có lên hoặc nhờ NIVO soạn nếu có thể.",
        "findings.presence_expected_holder.title": "Hồ sơ {{dossier}} thiếu {{expectation}} của {{holder}}",
        "findings.presence_expected_holder.detail":
            "Hồ sơ {{dossier}} cần {{expectation}} ghi tên {{holder}}, nhưng chưa tài liệu nào của hồ sơ nêu tên người này.",
        "findings.presence_dossier.title": "Chưa có tài liệu cho hồ sơ bắt buộc {{dossier}}",
        "findings.presence_dossier.detail":
            "Hồ sơ {{dossier}} là hồ sơ bắt buộc nhưng chưa có bản chính thức hay dự thảo nào.",
        "findings.signatures_unsigned.title": "{{expectation}} của hồ sơ {{dossier}} chưa ký",
        "findings.signatures_unsigned.detail":
            "Hồ sơ {{dossier}} mới có bản dự thảo hoặc bản chờ ký của {{expectation}}. Tải bản đã ký lên khi có.",
        "findings.signatures_placeholders.title": "Hồ sơ {{dossier}} còn {{count}} chỗ trống cần điền",
        "findings.signatures_placeholders.detail":
            "Tài liệu của hồ sơ {{dossier}} còn chỗ để trống hoặc số liệu chờ chọn, ví dụ: {{quote}}. Điền trước khi ký.",
        "findings.expiry_expired.title": "{{item}} của hồ sơ {{dossier}} đã hết hạn",
        "findings.expiry_expired.detail": "{{item}} hết hạn ngày {{date}}. Gia hạn hoặc cập nhật tài liệu mới.",
        "findings.expiry_expiring.title": "{{item}} của hồ sơ {{dossier}} sắp hết hạn",
        "findings.expiry_expiring.detail": "{{item}} hết hạn ngày {{date}}, còn dưới 60 ngày. Chuẩn bị gia hạn.",
        "findings.expiry_untracked.title": "Hồ sơ {{dossier}} chưa ghi ngày hết hạn",
        "findings.expiry_untracked.detail":
            "Tài liệu của hồ sơ {{dossier}} cần được theo dõi hạn, nhưng chưa thấy ngày hết hạn nào được ghi.",
        "findings.amounts_invariant.title": "{{invariant}} không thống nhất giữa các tài liệu",
        "findings.amounts_invariant.detail":
            "Các tài liệu ghi {{invariant}} khác nhau: {{values}}. Cần thống nhất một giá trị theo hồ sơ đăng ký.",
        "findings.amounts_contribution_overdue.title": "Vốn góp chưa đủ khi đã quá hạn 90 ngày",
        "findings.amounts_contribution_overdue.detail":
            "Vốn đã góp {{contributed}} thấp hơn vốn điều lệ {{capital}} trong khi hạn góp vốn đã qua ngày {{deadline}} (LDN Đ.47). Cần góp đủ hoặc đăng ký điều chỉnh vốn.",
        "findings.amounts_contribution_open.title": "Vốn góp còn thiếu so với vốn điều lệ",
        "findings.amounts_contribution_open.detail":
            "Vốn đã góp {{contributed}} thấp hơn vốn điều lệ {{capital}}. Hạn góp đủ là ngày {{deadline}}.",
        "findings.amounts_shares_total.title": "Tỷ lệ sở hữu của các thành viên không cộng đủ 100%",
        "findings.amounts_shares_total.detail": "Tổng tỷ lệ sở hữu ghi trong tài liệu là {{total}}%, không phải 100%.",
        "findings.amounts_shares_capital.title": "Phần vốn góp của {{member}} không khớp tỷ lệ",
        "findings.amounts_shares_capital.detail":
            "{{member}} được ghi góp {{capital}}, trong khi tỷ lệ sở hữu nhân vốn điều lệ là {{expected}}.",
        "findings.outdated_after_event.title": "Hồ sơ {{dossier}} chưa cập nhật sau {{event}}",
        "findings.outdated_after_event.detail":
            "{{event}} xảy ra ngày {{eventDate}}, nhưng tài liệu mới nhất của hồ sơ {{dossier}} lập ngày {{documentDate}}.",
        "findings.roles_holders.title": "Nhiều người cùng giữ vai trò {{role}}",
        "findings.roles_holders.detail":
            "Các tài liệu cùng lúc ghi {{holders}} là {{role}}. Cần cập nhật nơi còn ghi người cũ.",
        "findings.roles_left.title": "{{person}} đã nghỉ nhưng vẫn được ghi là {{role}}",
        "findings.roles_left.detail":
            "{{person}} nghỉ từ ngày {{leftOn}} nhưng tài liệu vẫn ghi là {{role}} và chưa có ngày kết thúc.",
        "findings.facts_conflict.title": "Hai tài liệu ghi {{attribute}} của {{subject}} khác nhau",
        "findings.facts_conflict.detail":
            "Một tài liệu ghi {{first}}, tài liệu khác ghi {{second}}. Chọn giá trị đúng ở Second Brain > Duyệt.",
        "findings.identifiers_tax.title": "Có {{count}} mã số thuế lạ trong tài liệu",
        "findings.identifiers_tax.detail":
            "Tài liệu ghi mã số thuế {{numbers}}, khác với mã số thuế đang dùng. Kiểm tra lại.",
        "findings.identifiers_id.title": "Có {{count}} số căn cước lạ trong tài liệu",
        "findings.identifiers_id.detail":
            "Tài liệu ghi số căn cước {{numbers}}, khác với số đã biết của các thành viên và nhân sự. Kiểm tra lại.",
        "findings.citations_repealed.title": "Tài liệu viện dẫn {{citation}} đã hết hiệu lực",
        "findings.citations_repealed.detail":
            "{{citation}} được thay bằng {{replacement}} từ ngày {{since}}. Cập nhật căn cứ pháp luật của tài liệu.",
        "findings.values_minimum_wage.title": "Mức lương thấp hơn lương tối thiểu vùng",
        "findings.values_minimum_wage.detail":
            "Mức lương {{amount}} thấp hơn lương tối thiểu vùng {{region}} là {{minimum}}.",
        "findings.values_dates_order.title": "Ngày kết thúc trước ngày bắt đầu",
        "findings.values_dates_order.detail": "{{subject}} có hiệu lực từ {{from}} nhưng kết thúc ngày {{to}}.",
        "findings.values_dates_future.title": "Tài liệu ghi ngày trong tương lai",
        "findings.values_dates_future.detail": "Tài liệu {{document}} ghi ngày {{date}}, sau ngày hôm nay.",
        "draft.tail":
            'Dự thảo do NIVO soạn ngày {{date}} theo phát hiện "{{title}}". Cần rà soát, điền chỗ trống và ký trước khi sử dụng.',
    },
    en: {
        "unfiled.label": "the documents not filed under a dossier",
        "errors.DOSSIER_REVIEW_FINDING_NOT_FOUND": "This finding does not exist in the workspace.",
        "errors.DOSSIER_REVIEW_DRAFT_NOT_FOUND": "This draft does not exist in the workspace.",
        "errors.DOSSIER_REVIEW_TRANSITION_REFUSED": "The finding or draft is no longer in a state that allows this.",
        "errors.DOSSIER_REVIEW_REASON_REQUIRED": "Write a reason or what was done, 3 to 500 characters.",
        "errors.DOSSIER_REVIEW_ASSIGNEE_NOT_MEMBER": "The assignee is not an active member of the workspace.",
        "errors.DOSSIER_REVIEW_DRAFT_DAILY_LIMIT": "Today's allowance of drafts is used. Try again tomorrow.",
        "errors.DOSSIER_REVIEW_NOTHING_TO_REVIEW": "There is no dossier to review. Import the checklist first.",
        "errors.DOSSIER_REVIEW_MODEL_UNAVAILABLE": "NIVO could not read the dossier just now. It will try again.",
        "errors.DOSSIER_REVIEW_PAGE_INVALID": "The page of the list is not valid. Load the list again from the start.",
        "findings.presence_expected.title": "Dossier {{dossier}} lacks {{expectation}}",
        "findings.presence_expected.detail":
            "No document of dossier {{dossier}} is {{expectation}}. Upload the copy you have, or ask NIVO to draft it where it can.",
        "findings.presence_expected_holder.title": "Dossier {{dossier}} lacks {{expectation}} of {{holder}}",
        "findings.presence_expected_holder.detail":
            "Dossier {{dossier}} needs {{expectation}} naming {{holder}}, but none of its documents names this person.",
        "findings.presence_dossier.title": "Required dossier {{dossier}} has no document",
        "findings.presence_dossier.detail":
            "Dossier {{dossier}} is required but holds neither a final copy nor a draft.",
        "findings.signatures_unsigned.title": "{{expectation}} of dossier {{dossier}} is not signed",
        "findings.signatures_unsigned.detail":
            "Dossier {{dossier}} only holds a draft or a copy awaiting signature of {{expectation}}. Upload the signed copy once you have it.",
        "findings.signatures_placeholders.title": "Dossier {{dossier}} has {{count}} blanks to fill in",
        "findings.signatures_placeholders.detail":
            "Documents of dossier {{dossier}} still hold blanks or figures to choose, for example: {{quote}}. Fill them in before signing.",
        "findings.expiry_expired.title": "{{item}} of dossier {{dossier}} has expired",
        "findings.expiry_expired.detail": "{{item}} expired on {{date}}. Renew it or file the new document.",
        "findings.expiry_expiring.title": "{{item}} of dossier {{dossier}} expires soon",
        "findings.expiry_expiring.detail": "{{item}} expires on {{date}}, in under 60 days. Prepare the renewal.",
        "findings.expiry_untracked.title": "Dossier {{dossier}} records no expiry date",
        "findings.expiry_untracked.detail":
            "The documents of dossier {{dossier}} need their expiry tracked, but no expiry date is recorded.",
        "findings.amounts_invariant.title": "{{invariant}} differs between documents",
        "findings.amounts_invariant.detail":
            "The documents give different values of {{invariant}}: {{values}}. Settle on the registered value.",
        "findings.amounts_contribution_overdue.title": "Capital not fully contributed after the 90-day deadline",
        "findings.amounts_contribution_overdue.detail":
            "The contributed capital {{contributed}} is below the charter capital {{capital}} and the deadline passed on {{deadline}} (LDN Art. 47). Contribute in full or register the reduced capital.",
        "findings.amounts_contribution_open.title": "Contributed capital is still below the charter capital",
        "findings.amounts_contribution_open.detail":
            "The contributed capital {{contributed}} is below the charter capital {{capital}}. The deadline is {{deadline}}.",
        "findings.amounts_shares_total.title": "Members' shares do not add up to 100%",
        "findings.amounts_shares_total.detail": "The ownership shares in the documents add up to {{total}}%, not 100%.",
        "findings.amounts_shares_capital.title": "The capital of {{member}} does not match the share",
        "findings.amounts_shares_capital.detail":
            "{{member}} is recorded with {{capital}}, while the share times the charter capital is {{expected}}.",
        "findings.outdated_after_event.title": "Dossier {{dossier}} was not updated after {{event}}",
        "findings.outdated_after_event.detail":
            "{{event}} happened on {{eventDate}}, but the newest document of dossier {{dossier}} is dated {{documentDate}}.",
        "findings.roles_holders.title": "Several people hold {{role}} at the same time",
        "findings.roles_holders.detail":
            "The documents name {{holders}} as {{role}} at the same time. Update wherever the former holder is still named.",
        "findings.roles_left.title": "{{person}} left but is still named {{role}}",
        "findings.roles_left.detail":
            "{{person}} left on {{leftOn}} but a document still names them {{role}} with no end date.",
        "findings.facts_conflict.title": "Two documents give a different {{attribute}} of {{subject}}",
        "findings.facts_conflict.detail":
            "One document says {{first}}, another says {{second}}. Choose the right value in Second Brain > Review.",
        "findings.identifiers_tax.title": "{{count}} unknown tax codes in the documents",
        "findings.identifiers_tax.detail":
            "The documents give the tax code {{numbers}}, unlike the one in use. Check them.",
        "findings.identifiers_id.title": "{{count}} unknown ID numbers in the documents",
        "findings.identifiers_id.detail":
            "The documents give the ID number {{numbers}}, unlike those known of the members and staff. Check them.",
        "findings.citations_repealed.title": "A document cites {{citation}}, which is no longer in force",
        "findings.citations_repealed.detail":
            "{{citation}} was replaced by {{replacement}} from {{since}}. Update the legal basis of the document.",
        "findings.values_minimum_wage.title": "A wage is below the regional minimum",
        "findings.values_minimum_wage.detail":
            "The wage {{amount}} is below the region {{region}} minimum of {{minimum}}.",
        "findings.values_dates_order.title": "An end date comes before its start",
        "findings.values_dates_order.detail": "{{subject}} holds from {{from}} but ends on {{to}}.",
        "findings.values_dates_future.title": "A document is dated in the future",
        "findings.values_dates_future.detail": "The document {{document}} is dated {{date}}, after today.",
        "draft.tail":
            'Drafted by NIVO on {{date}} for the finding "{{title}}". Review it, fill in the blanks and sign it before use.',
    },
}
