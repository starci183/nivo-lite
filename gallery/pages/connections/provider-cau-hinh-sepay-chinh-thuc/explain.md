---
title: SePay › chọn "Chính thức" rồi "Lưu"
route: /workspaces/<ws>/connections/open/<id>
area: connections
---
# Hộp xác nhận khi lựa chọn có `confirm`
Chọn "Chính thức" ở trường Môi trường rồi bấm "Lưu": hộp `AlertDialog` hỏi bằng lời của API (câu xác nhận do be trả về; fe không giữ câu nào về ghi sổ hay đối soát); "Hủy" đứng đầu, "Xác nhận" đứng cuối; chỉ khi xác nhận mới gửi. Nút xác nhận tô màu nhấn vì thay đổi không phá hủy (luật `AlertDialog`: nguy hiểm chỉ cho hành động không hoàn tác).
