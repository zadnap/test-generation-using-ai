# Test AI sinh và đo coverage

Thực hiện các lệnh bên dưới bằng **PowerShell tại thư mục gốc repository**, sau khi đã cài dependencies.

## Chạy test

Chạy toàn bộ test AI sinh:

```powershell
npx vitest run --config ai-generated-tests/vitest.config.mts
```

Chạy riêng test của một module:

```powershell
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/websockets
```

## Chọn phạm vi coverage

Biến môi trường `COVERAGE_MODULES` chọn **source được đo coverage**, không giới hạn test được chạy. Các lệnh dưới đây chạy toàn bộ test AI sinh.

### Một module

```powershell
$env:COVERAGE_MODULES = 'common'
npx vitest run --config ai-generated-tests/vitest.config.mts --coverage
```

Thay `common` bằng tên thư mục trực tiếp trong `packages/`, ví dụ `core`, `microservices`, `platform-express`, `platform-fastify`, `platform-node`, `platform-socket.io`, `platform-ws`, `testing` hoặc `websockets`.

### Nhiều module

Phân cách tên module bằng dấu phẩy:

```powershell
$env:COVERAGE_MODULES = 'platform-fastify,platform-socket.io,websockets'
npx vitest run --config ai-generated-tests/vitest.config.mts --coverage
```

### Toàn bộ module

```powershell
$env:COVERAGE_MODULES = 'all'
npx vitest run --config ai-generated-tests/vitest.config.mts --coverage
```

Không đặt biến môi trường cũng mặc định là `all`. Biến đã đặt tồn tại trong phiên PowerShell hiện tại; để xóa:

```powershell
Remove-Item Env:COVERAGE_MODULES -ErrorAction SilentlyContinue
```

Tên module không hợp lệ hoặc kết hợp `all` với tên module khác sẽ khiến cấu hình báo lỗi.

## Phạm vi và cách đọc kết quả

- Source được đo: `packages/**/*.ts`, hoặc các thư mục module đã chọn.
- Loại trừ: `node_modules`, file `.d.ts`, `.spec.ts`, `.test.ts` và các thư mục `packages/**/test/**`.
- Các file production như adapter, service và module vẫn được tính; không loại bỏ chỉ vì khó kiểm thử.
- `All files` tổng hợp các file thuộc phạm vi coverage sau khi áp dụng loại trừ. Chọn `all` sẽ tính cả module chưa có test AI, nên tỷ lệ có thể thấp.
- `% Branch` là Branch Coverage do V8/Vitest báo cáo, không đồng nghĩa với C3 hay bằng chứng mọi điều kiện nguyên tử đã được đánh giá cả true và false.
- Coverage đo bằng toàn bộ suite có thể bao gồm các lần thực thi gián tiếp từ test của module khác.

Khi so sánh trước/sau hoặc giữa các bộ test, giữ nguyên phạm vi source, quy tắc loại trừ và coverage provider.

## Báo cáo

Cấu hình xuất bảng terminal, HTML và JSON summary:

| Phạm vi | Thư mục kết quả |
| --- | --- |
| Một module | `ai-generated-tests/coverage/common/` (ví dụ) |
| Nhiều module | `ai-generated-tests/coverage/platform-fastify+platform-socket.io+websockets/` (ví dụ) |
| Toàn bộ | `ai-generated-tests/coverage/all/` |

Mở `index.html` trong thư mục tương ứng để xem báo cáo HTML; đọc `coverage-summary.json` để lấy số liệu tổng hợp. Chạy lại cùng phạm vi sẽ ghi đè báo cáo trong cùng thư mục.

Các hướng dẫn này sử dụng `ai-generated-tests/vitest.config.mts`. Lệnh `npm run coverage` sử dụng cấu hình coverage ở root, với bộ test và quy tắc loại trừ khác, nên kết quả không so sánh trực tiếp được.
