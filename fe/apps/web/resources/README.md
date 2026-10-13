# resources

Thư mục này chứa các tài nguyên của NIVO được nạp (seed) vào Supabase. Chúng là dữ liệu có phiên bản nằm trong kho mã, không phải dữ liệu của từng doanh nghiệp.

## Cấu trúc

```
resources/
  nivo-knowledge/           Tri thức NIVO nền, chỉ đọc với thành viên workspace
    core/                   Dùng chung cho mọi module
    <key>/                  Một thư mục mỗi module (knowledgeFolder trong danh mục module của be)
      <slug>.md             Một tài liệu = một dòng trong bảng nivo_knowledge
```

Mỗi tệp `.md` có phần đầu (frontmatter) gồm:

- `title`: tiêu đề hiển thị
- `kind`: `playbook` | `authority` | `escalation` | `setup_checklist` | `tone`
- `version`: số nguyên, tăng khi nội dung đổi

Tên tệp (không có `.md`) là `slug` duy nhất; thư mục cha là `module`. Phần còn lại là nội dung markdown.

Sau này có thể thêm loại tài nguyên khác theo cùng cách, ví dụ `resources/knowledge-suggestions/` hoặc `resources/templates/`, mỗi loại một thư mục riêng và một bước nạp riêng trong `scripts/`.

## Registry module

The module catalogue is typed data in `be/src/modules/domain/modules` (served by `GET /modules`); `cli seed-modules run` mirrors it into the `modules` and `authority_actions` tables. The front end reads the mirror in `src/modules/catalog`.

## Nạp vào Supabase

Cần Supabase local đang chạy và đã áp dụng migration `20261002140000_knowledge.sql`.

```
npm run seed:knowledge
```

Lệnh này đọc mọi tệp trong `resources/nivo-knowledge`, cập nhật theo `slug` (chạy lại nhiều lần không tạo bản sao) và tạo embedding khi có khóa API (`EMBEDDING_API_KEY`, hoặc `OPENROUTER_API_KEY`/`OPENAI_API_KEY`). Không có khóa thì vẫn nạp nội dung, tìm kiếm theo từ khóa vẫn hoạt động.
