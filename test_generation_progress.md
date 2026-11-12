# Test Generation Progress

## Module hiện tại

- Module: `packages/websockets` (hoàn tất)
- Module trước: `packages/platform-fastify`, `packages/platform-socket.io`, `packages/common/module-utils`, `packages/common/file-stream`, `packages/common/serializer`, `packages/common/enums`, `packages/common/exceptions`, `packages/common/decorators`, `packages/common/interfaces`, `packages/common/services`, `packages/common/utils`, `packages/common/pipes` (hoàn tất)
- Repository: `nestjs/nest` (TypeScript, ESM)
- Test framework: Vitest `5.1.0`
- Coverage engine: `@vitest/coverage-v8`
- Ngôn ngữ test: TypeScript (`*.spec.ts`)
- Thư mục test AI sinh: `ai-generated-tests/packages/websockets/`
- Không sửa production code, file build/dependency hay test có sẵn.

## Module 1 - `packages/common/pipes`

## Bước 1 - Khảo sát project

- Test runner của repo: `vitest` (`npm test` -> `vitest run`).
- Cấu hình gốc: `vitest.config.mts`; alias `@nestjs/*`, setup `reflect-metadata`.
- Test hiện có của module: `packages/common/test/pipes/**/*.spec.ts`.
- Baseline chạy trước khi sinh test:

```bash
npx vitest run packages/common/test/pipes --reporter=dot
```

Kết quả baseline: **14 test files, 308 tests passed**.

- Cấu hình riêng cho test AI sinh: `ai-generated-tests/vitest.config.mts`.
  Cấu hình này chỉ include `ai-generated-tests/**/*.spec.ts` và chỉ đo coverage cho
  `packages/common/pipes/**/*.ts`, không chạy test suite có sẵn.

## Bước 2 - Phân loại hàm

### In-scope (đã sinh test)

| File production | Hàm/phương thức | Trạng thái |
| --- | --- | --- |
| `default-value.pipe.ts` | `transform`, `copyDefaultValue` | Tested |
| `parse-array.pipe.ts` | `constructor`, `transform`, `isExpectedTypePrimitive`, `validatePrimitive`, `isNumeric` | Tested |
| `parse-bool.pipe.ts` | `constructor`, `transform`, `isTrue`, `isFalse` | Tested |
| `parse-date.pipe.ts` | `constructor`, `transform` | Tested |
| `parse-enum.pipe.ts` | `constructor`, `transform`, `isEnum`, `toEnumValue`, `getEnumValues`, `computeEnumValues` | Tested |
| `parse-float.pipe.ts` | `constructor`, `transform`, `isNumeric` | Tested |
| `parse-int.pipe.ts` | `constructor`, `transform`, `isNumeric` | Tested |
| `parse-uuid.pipe.ts` | `constructor`, `transform`, `isUUID` | Tested |
| `standard-schema-validation.pipe.ts` | `constructor`, `transform`, `formatIssueMessages`, `toValidate`, `validate`, `stripProtoKeys` | Tested |
| `validation.pipe.ts` | `constructor`, `loadValidator`, `loadTransformer`, `transform`, `createExceptionFactory`, `limitValidationErrors`, `toValidate`, `transformPrimitive`, `toEmptyIfNil`, `isPrimitive`, `stripProtoKeys`, `validate`, `hasValidationRules`, `flattenValidationErrors`, `groupValidationErrors`, `mapChildrenToValidationErrors`, `prependConstraintsWithParentProp` | Tested |
| `file/file-type.validator.ts` | `buildErrorMessage`, `isValid`, `matchesFileType` (qua `isValid`) | Tested |
| `file/max-file-size.validator.ts` | `buildErrorMessage`, `isValid` | Tested |
| `file/parse-file-pipe.builder.ts` | `addMaxSizeValidator`, `addFileTypeValidator`, `addValidator`, `build` | Tested |
| `file/parse-file.pipe.ts` | `constructor`, `transform`, `validateFilesOrFile`, `thereAreNoFilesIn`, `validate`, `validateOrThrow`, `getValidators` | Tested |

### Out-of-scope (không có logic thực thi)

- `pipes/index.ts`, `file/index.ts`: chỉ re-export.
- `file/file-validator.interface.ts`: abstract contract, không có thân hàm.
- `file/file-validator-context.interface.ts`: type-only.
- `file/parse-file-options.interface.ts`: interface-only.
- `file/interfaces/file.interface.ts`, `file/interfaces/index.ts`: type-only.

### Indirect dependency

- `class-validator`, `class-transformer`: dùng thật trong các test validation.
- `file-type`: dùng thật cho magic-number; có test double qua buffer proxy cho nhánh lỗi.
- `shared.utils`, `http-error-by-code.util`, `strip-proto-keys.util`: dùng thật.
- Các package validator/transformer được thay bằng stub **chỉ khi cần ép một nhánh cụ thể**
  (ví dụ `plainToInstance` trả primitive/empty string). Logic của module vẫn là logic thật.

## Bước 3-4 - CFG / C3 và test path

- Với mỗi hàm, các điều kiện con trong biểu thức phức được tách theo short-circuit.
- Test được thiết kế để mỗi điều kiện nguyên tử được đánh giá cả `True` và `False`,
  đồng thời mỗi decision tổng thể có cả hai kết quả.
- Ví dụ các nhóm điều kiện đã phủ:
  - `isNil(value) && optional` (cả hai vế T/F, kể cả short-circuit).
  - `typeof value === 'number'`, `typeof value !== 'string'`, `value === ''`,
    `value !== value.trim()`, các prefix `0x/0X/0b/0B/0o/0O`.
  - `A || B` trong `isTrue`, `isFalse`, kiểm tra version UUID, regex, fallback mimetype.
  - Chuỗi điều kiện lồng nhau trong `ValidationPipe.transform`,
    `limitValidationErrors`, `flattenValidationErrors`, `groupValidationErrors`.
  - Các nhánh lỗi của `ParseArrayPipe` (`getResponse`, `message` dạng array/object/scalar,
    path `...`, item lỗi không có `getResponse`, sparse array).
  - Các nhánh magic-number của `FileTypeValidator` gồm detect thành công,
    không detect được, fallback mimetype, skip magic numbers, override mimetype,
    và catch `Error`/non-`Error`.
- Không có path bị chặn. Nhánh `toEnumValue(value) ?? value` chỉ đạt được khi subclass
  override `isEnum`/`toEnumValue`; đã có test cho trường hợp mở rộng này.

## Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/pipes/default-value.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/parse-array.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/parse-bool.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/parse-date.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/parse-enum.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/parse-float.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/parse-int.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/parse-uuid.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/standard-schema-validation.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/validation.pipe.spec.ts`
- `ai-generated-tests/packages/common/pipes/file/file-type.validator.spec.ts`
- `ai-generated-tests/packages/common/pipes/file/max-file-size.validator.spec.ts`
- `ai-generated-tests/packages/common/pipes/file/parse-file-pipe.builder.spec.ts`
- `ai-generated-tests/packages/common/pipes/file/parse-file.pipe.spec.ts`
- `ai-generated-tests/vitest.config.mts`

## Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts
```

Kết quả: **14 test files, 477 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/pipes`):

- Statements: **100%** (478/478)
- Branches: **100%** (459/459)
- Functions: **100%** (95/95)
- Lines: **100%** (471/471)

Giới hạn công cụ: `@vitest/coverage-v8` báo cáo **branch coverage**, không báo cáo
trực tiếp C3 (condition coverage). C3 được thiết kế thủ công bằng cách tách điều kiện
nguyên tử và sinh input cho cả hai kết quả; toàn bộ điều kiện nguyên tử khả thi trong
module đều đã được kích hoạt T/F. Không có hàm bị BLOCKED.

## Bước 7 - Trạng thái

- Module `packages/common/pipes`: **hoàn tất**.
- Số hàm in-scope đã sinh test: **67** (bao gồm constructor và helper protected).
- Số hàm bỏ qua: các file interface/export/abstract nêu trên (không có logic để test).
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 2 - `packages/common/utils`

### Bước 1 - Khảo sát project

- Test hiện có của module: `packages/common/test/utils/**/*.spec.ts`.
- Baseline chạy trước khi sinh test:

```bash
npx vitest run packages/common/test/utils --reporter=dot
```

Kết quả baseline: **14 test files, 114 tests passed**.

- Cấu hình AI `ai-generated-tests/vitest.config.mts` được cập nhật để chỉ include
  `ai-generated-tests/**/*.spec.ts` và đo coverage cho `packages/common/utils/**/*.ts`
  (loại `index.ts` chỉ re-export).

### Bước 2 - Phân loại hàm

#### In-scope (đã sinh test)

| File production | Hàm/phương thức | Trạng thái |
| --- | --- | --- |
| `assign-custom-metadata.util.ts` | `assignCustomMetadata` | Tested |
| `cli-colors.util.ts` | `isColorAllowed`, `colorIfAllowed`, toàn bộ hàm trong `clc`, `yellow` | Tested |
| `extend-metadata.util.ts` | `extendArrayMetadata`, `getParamArgsMetadata` | Tested |
| `forward-ref.util.ts` | `forwardRef` | Tested |
| `http-error-by-code.util.ts` | map `HttpErrorByCode` (21 status code) | Tested |
| `is-streaming-body.util.ts` | `isStreamingBody` | Tested |
| `load-package.util.ts` | `loadPackage`, `loadPackageSync`, `loadPackageCached`, `tryLoadPackage` | Tested |
| `merge-with-values.util.ts` | `MergeWithValues` | Tested |
| `parameter-decorator-options.util.ts` | `isPipeLike`, `isParameterDecoratorOptions` | Tested (2 nhánh infeasible) |
| `random-string-generator.util.ts` | `randomStringGenerator` | Tested |
| `select-exception-filter-metadata.util.ts` | `selectExceptionFilterMetadata` | Tested |
| `shared.utils.ts` | `isUndefined`, `isObject`, `isPlainObject`, `addLeadingSlash`, `normalizePath`, `stripEndSlash`, `isFunction`, `isString`, `isNumber`, `isConstructor`, `isNil`, `isEmpty`, `isEmptyArray`, `isSymbol` | Tested |
| `strip-proto-keys.util.ts` | `stripProtoKeys` | Tested |
| `validate-each.util.ts` | `validateEach`, `InvalidDecoratorItemException` constructor, `what` | Tested |
| `validate-module-keys.util.ts` | `INVALID_MODULE_CONFIG_MESSAGE`, `validateModuleKeys`, `validateKey` | Tested |

#### Out-of-scope

- `packages/common/utils/index.ts`: chỉ re-export.

### Bước 3-4 - CFG / C3 và test path

- Các điều kiện nguyên tử đã được tách theo short-circuit và phủ cả `True`/`False`:
  - `cli-colors`: `NO_COLOR` chưa set/chuỗi rỗng/truthy; nhánh màu bật/tắt.
  - `is-streaming-body`: short-circuit của `isObject`, `asyncIterator` là function,
    `then` là function, `Symbol.toStringTag === 'Response'`, `Response` thật.
  - `shared.utils`: toàn bộ predicate, path rỗng/không bắt đầu bằng `/`, nhiều dấu `/`,
    object literal/null-prototype/kế thừa constructor/class instance/array/Date/Map.
  - `strip-proto-keys`: vòng lặp `for...in` (own + inherited enumerable), mảng thưa,
    typed array/Buffer, built-in instance, `constructor` built-in/falsy, shared reference,
    cycle, `Object.values` chỉ duyệt phần tử thực.
  - `extend-metadata`: metadata chưa có/đã có, args riêng/kế thừa, cùng index nhưng
    khác reference, method key dạng symbol.
  - `load-package`: cache hit/miss, loader function/dynamic import/createRequire,
    thành công/thất bại, `process.exit(1)` + `Logger.error` + `Logger.flush`.
  - `validate-module-keys`: từng key hợp lệ, danh sách rỗng, key sai, tagged template.
  - `validate-each`: context null/undefined/name rỗng, mảng rỗng, predicate đúng/sai,
    short-circuit tại item lỗi đầu tiên.
  - `parameter-decorator-options`: falsy, object thường, `schema`/`pipes` own/inherited,
    transform function/non-function, pipe instance, class constructor.
- **Nhánh infeasible đã ghi nhận:** trong `parameter-decorator-options.util.ts`,
  `isPipeLike` chỉ được gọi sau `!!value && typeof value === 'object'`. Vì vậy:
  - nhánh nullish của `value?.transform` (line 5) không thể xảy ra;
  - nhánh `isFunction(value)` bên trong `isPipeLike` không thể đúng vì function có
    `typeof === 'function'` và đã bị chặn trước đó.
  Đây là dead/infeasible branch của production code, không thể phủ nếu không sửa source.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/utils/assign-custom-metadata.util.spec.ts`
- `ai-generated-tests/packages/common/utils/cli-colors.util.spec.ts`
- `ai-generated-tests/packages/common/utils/extend-metadata.util.spec.ts`
- `ai-generated-tests/packages/common/utils/forward-ref.util.spec.ts`
- `ai-generated-tests/packages/common/utils/http-error-by-code.util.spec.ts`
- `ai-generated-tests/packages/common/utils/is-streaming-body.util.spec.ts`
- `ai-generated-tests/packages/common/utils/load-package.util.spec.ts`
- `ai-generated-tests/packages/common/utils/merge-with-values.util.spec.ts`
- `ai-generated-tests/packages/common/utils/parameter-decorator-options.util.spec.ts`
- `ai-generated-tests/packages/common/utils/random-string-generator.util.spec.ts`
- `ai-generated-tests/packages/common/utils/select-exception-filter-metadata.util.spec.ts`
- `ai-generated-tests/packages/common/utils/shared.utils.spec.ts`
- `ai-generated-tests/packages/common/utils/strip-proto-keys.util.spec.ts`
- `ai-generated-tests/packages/common/utils/validate-each.util.spec.ts`
- `ai-generated-tests/packages/common/utils/validate-module-keys.util.spec.ts`

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/utils --reporter=dot
```

Kết quả: **15 test files, 253 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/utils --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/utils`):

- Statements: **100%** (161/161)
- Branches: **97.87%** (92/94)
- Functions: **100%** (53/53)
- Lines: **100%** (154/154)

Hai branch còn lại nằm ở dead/infeasible path của
`parameter-decorator-options.util.ts` như mô tả tại Bước 3-4.

### Bước 7 - Trạng thái

- Module `packages/common/utils`: **hoàn tất** (trừ 2 nhánh infeasible đã ghi nhận).
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 3 - `packages/common/services`

### Bước 1 - Khảo sát project

- Test hiện có của module: `packages/common/test/services/**/*.spec.ts`.
- Baseline chạy trước khi sinh test:

```bash
npx vitest run packages/common/test/services --reporter=dot
```

Kết quả baseline: **4 test files, 190 tests passed**.

- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật để chỉ include
  `ai-generated-tests/**/*.spec.ts` và đo coverage cho `packages/common/services/**/*.ts`
  (loại `index.ts` và `utils/index.ts` chỉ re-export).

### Bước 2 - Phân loại hàm

#### In-scope (đã sinh test)

| File production | Hàm/phương thức | Trạng thái |
| --- | --- | --- |
| `utils/filter-log-levels.util.ts` | `filterLogLevels` | Tested |
| `utils/get-env-log-levels.util.ts` | `getEnvLogLevels`, hằng `LOG_LEVEL_ENV_VAR` | Tested |
| `utils/is-log-level.util.ts` | `isLogLevel` | Tested |
| `utils/is-log-level-enabled.util.ts` | `isLogLevelEnabled` | Tested |
| `utils/redact.util.ts` | `createRedactor`, `isOpaque`, `DEFAULT_REDACT_CENSOR` | Tested |
| `logger.service.ts` | constructor, `localInstance`, `error`, `log`, `warn`, `debug`, `verbose`, `fatal`, các static method tương ứng, `flush`, `attachBuffer`, `detachBuffer`, `getTimestamp`, `overrideLogger`, `isLevelEnabled`, `registerLocalInstanceRef`, `WrapBuffer` | Tested |
| `console-logger.service.ts` | constructor, `log`, `error`, `warn`, `debug`, `verbose`, `fatal`, `setLogLevels`, `setContext`, `resetContext`, `isLevelEnabled`, `getDefaultLogLevels`, `getTimestamp`, `printMessages`, `printAsJson`, `getJsonLogObject`, `extractJsonError`, `serializeError`, `redact`, `formatPid`, `formatContext`, `formatMessage`, `stringifyParams`, `resolveMessage`, `stringifyMessage`, `colorize`, `printStackTrace`, `updateAndGetTimestampDiff`, `formatTimestampDiff`, `getInspectOptions`, `stringifyJsonLogObject`, `stringifyReplacer`, `getContextAndMessagesToPrint`, `getContextAndStackAndMessagesToPrint`, `isStackFormat`, `getColorByLogLevel` | Tested |

#### Out-of-scope

- `packages/common/services/index.ts`, `packages/common/services/utils/index.ts`: chỉ re-export.
- `packages/common/services/log-levels.constant.ts`: chỉ khai báo hằng/type, không có logic.

### Bước 3-4 - CFG / C3 và test path

- Các điều kiện nguyên tử đã được tách theo short-circuit và phủ cả `True`/`False`:
  - `filterLogLevels`: nhánh `>`, `>=`, danh sách, level đơn, rỗng, level không hợp lệ,
    `orEqual`, `logLevelIndex === -1`.
  - `getEnvLogLevels`: biến chưa set/rỗng/toàn khoảng trắng, threshold `>`/`>=`,
    danh sách, level đơn, giá trị không hợp lệ, regex threshold.
  - `isLogLevelEnabled`: `undefined`, mảng rỗng, level có trong danh sách, level trên/dưới
    ngưỡng cao nhất, danh sách không sắp xếp.
  - `redact`: key đơn, dotted path (khớp/không khớp theo key cuối, độ sâu, parent),
    path rỗng, key không phân biệt hoa thường, array/Map/Set/class instance/Error,
    `cause`/`AggregateError#errors`, `__proto__`, null-prototype, circular, shared
    reference theo context, getter ném lỗi, toàn bộ opaque type (`Date`, `RegExp`,
    `Promise`, `WeakMap`, `WeakSet`, `ArrayBuffer`, typed array/DataView), copy/không copy.
  - `Logger`: static instance mặc định/plain Logger/subclass/custom/undefined, context
    có/không, `error` thêm placeholder `undefined`, optional method thiếu, buffer
    attach/detach/flush, `overrideLogger` array/object/plain/subclass/boolean,
    `isLevelEnabled` cho ConsoleLogger/custom/undefined, cập nhật local instance khi
    `logLevels` đổi/không đổi/không có.
  - `ConsoleLogger`: toàn bộ overload constructor, màu theo `json`/`NO_COLOR`,
    redact array/object/rỗng, mọi level bật/tắt, `getDefaultLogLevels` đọc env hợp lệ/
    không hợp lệ và chỉ cảnh báo một lần, text/JSON output, `forceConsole`,
    stdout/stderr mặc định, stack trace, timestamp có/không màu, message dạng class/
    lazy function/object/array/primitive, colorize theo level, toàn bộ nhánh tách
    context/message/stack/params, `isStackFormat`, `getInspectOptions`, JSON replacer
    (BigInt/symbol/Map/Set/Error), circular, shared branch, truncation,
    `toJSON` ném lỗi fallback inspect, serialize error lồng nhau/circular/quá depth,
    flatten params và xung đột key framework.
- Không có path infeasible trong module này.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/services/utils/filter-log-levels.util.spec.ts`
- `ai-generated-tests/packages/common/services/utils/get-env-log-levels.util.spec.ts`
- `ai-generated-tests/packages/common/services/utils/is-log-level.util.spec.ts`
- `ai-generated-tests/packages/common/services/utils/is-log-level-enabled.util.spec.ts`
- `ai-generated-tests/packages/common/services/utils/redact.util.spec.ts`
- `ai-generated-tests/packages/common/services/logger.service.spec.ts`
- `ai-generated-tests/packages/common/services/console-logger.service.spec.ts`

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/services --reporter=dot
```

Kết quả: **7 test files, 302 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/services --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/services`):

- Statements: **100%** (487/487)
- Branches: **100%** (371/371)
- Functions: **100%** (86/86)
- Lines: **100%** (482/482)

Giới hạn công cụ: `@vitest/coverage-v8` báo cáo **branch coverage**, không báo trực tiếp
C3. C3 được thiết kế thủ công bằng cách tách từng điều kiện nguyên tử và sinh input cho
cả hai kết quả; toàn bộ điều kiện khả thi trong module đều đã được kích hoạt T/F.

### Bước 7 - Trạng thái

- Module `packages/common/services`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 4 - `packages/common/interfaces`

### Bước 1 - Khảo sát project

- Module không có thư mục test hiện có (`packages/common/test/interfaces` không tồn tại),
  baseline module-specific: **0 test files, 0 tests**.
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.
- Đặc điểm module: hầu hết file là type/interface-only, không có logic thực thi.
- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật để đo coverage cho
  `packages/common/interfaces/**/*.ts`, loại toàn bộ `**/index.ts` (chỉ re-export).

### Bước 2 - Phân loại hàm

#### In-scope (có runtime code)

| File production | Thành phần runtime | Trạng thái |
| --- | --- | --- |
| `scope-options.interface.ts` | enum `Scope` (`DEFAULT`, `TRANSIENT`, `REQUEST`) | Tested |
| `nest-application-context-options.interface.ts` | class `NestApplicationContextOptions` (field declarations, không có method) | Tested |
| `version-options.interface.ts` | hằng `VERSION_NEUTRAL` (`Symbol`) | Tested |

#### Out-of-scope

- 7 file `index.ts`: chỉ re-export.
- 61 file còn lại: interface/type/abstract contract thuần TypeScript, bị xóa hoàn toàn khi
  transpile nên không có statement/branch để kiểm thử.
- `NestApplicationContextOptions`: sau khi transpile chỉ còn class rỗng (field không có
  initializer bị loại bỏ); test chỉ xác nhận khởi tạo và gán/nhận giá trị.

### Bước 3-4 - CFG / C3 và test path

- Module không có quyết định (decision) hay điều kiện nguyên tử trong runtime code.
- Enum `Scope` được kiểm tra theo từng member, reverse mapping và giới hạn member.
- `VERSION_NEUTRAL` được kiểm tra kiểu symbol, description, tính duy nhất và tính ổn định
  khi import lại.
- `NestApplicationContextOptions` được kiểm tra khởi tạo mặc định (mọi field `undefined`)
  và gán từng nhóm giá trị hợp lệ (`logger`, boolean flags, `moduleIdGeneratorAlgorithm`,
  `instrument`).
- Không có path infeasible; branch coverage là 0/0 (vacuous 100%).

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/interfaces/scope-options.interface.spec.ts`
- `ai-generated-tests/packages/common/interfaces/nest-application-context-options.interface.spec.ts`
- `ai-generated-tests/packages/common/interfaces/version-options.interface.spec.ts`

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/interfaces --reporter=dot
```

Kết quả: **3 test files, 25 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/interfaces --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/interfaces`):

- Statements: **100%** (5/5)
- Branches: **100%** (0/0)
- Functions: **100%** (1/1)
- Lines: **100%** (5/5)
- 62 file type-only/rỗng được v8 bỏ qua vì không có mã thực thi.

### Bước 7 - Trạng thái

- Module `packages/common/interfaces`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 5 - `packages/common/decorators`

### Bước 1 - Khảo sát project

- Module có 25 file production trong `core/`, `http/`, `modules/` (không tính 3 file
  `index.ts` chỉ re-export).
- Test hiện có: `packages/common/test/decorators/*.spec.ts` (25 file).
- Baseline chạy trước khi sinh test:

```bash
npx vitest run packages/common/test/decorators --reporter=dot
```

Kết quả baseline: **25 test files, 183 tests passed**.

- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật để đo coverage cho
  `packages/common/decorators/**/*.ts`, loại toàn bộ `**/index.ts`.
- Import trong test AI dùng 5 cấp `..` vì file nằm thêm một cấp `core/http/modules`.
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.

### Bước 2 - Phân loại hàm

#### In-scope (có runtime code)

| File production | Thành phần runtime | Trạng thái |
| --- | --- | --- |
| `core/apply-decorators.ts` | `applyDecorators` (class/method dispatch) | Tested |
| `core/bind.decorator.ts` | `Bind` | Tested |
| `core/catch.decorator.ts` | `Catch`, watermark + exception metadata | Tested |
| `core/controller.decorator.ts` | `Controller` (default/string/array/options, path/host/scope/version, dedupe version) | Tested |
| `core/dependencies.decorator.ts` | `flatten`, `Dependencies` | Tested |
| `core/exception-filters.decorator.ts` | `UseFilters`, `addExceptionFiltersMetadata`, filter validation | Tested |
| `core/inject.decorator.ts` | `Inject` (token/design:type/paramtypes, param/property) | Tested |
| `core/injectable.decorator.ts` | `Injectable`, `mixin` (rename + paramtypes fallback) | Tested |
| `core/optional.decorator.ts` | `Optional` (parameter/property indexes) | Tested |
| `core/set-metadata.decorator.ts` | `SetMetadata`, `KEY` | Tested |
| `core/use-guards.decorator.ts` | `UseGuards`, guard validation, method/class metadata | Tested |
| `core/use-interceptors.decorator.ts` | `UseInterceptors`, interceptor validation, method/class metadata | Tested |
| `core/use-pipes.decorator.ts` | `UsePipes`, pipe validation, method/class metadata | Tested |
| `core/version.decorator.ts` | `Version` (scalar + dedupe array) | Tested |
| `http/create-route-param-metadata.decorator.ts` | `createParamDecorator`, pipe/options classification, enhancers | Tested |
| `http/header.decorator.ts` | `Header` | Tested |
| `http/http-code.decorator.ts` | `HttpCode` | Tested |
| `http/redirect.decorator.ts` | `Redirect` (defaults + status) | Tested |
| `http/render.decorator.ts` | `Render` | Tested |
| `http/request-mapping.decorator.ts` | `RequestMapping`, `createMappingDecorator`, toàn bộ alias HTTP/WebDAV | Tested |
| `http/route-params.decorator.ts` | `assignMetadata`, `createRouteParamDecorator`, `createPipesRouteParamDecorator`, `Request`/`Response`/`Next`/`Ip`/`Session`/`UploadedFile`/`UploadedFiles`/`Headers`/`Query`/`Body`/`RawBody`/`Param`/`HostParam`/`Cookies`/`SignedCookies`/`Req`/`Res` | Tested |
| `http/sse-signal.decorator.ts` | `SSE_ABORT_CONTROLLER`, `SseSignal` (factory + abort signal lookup) | Tested |
| `http/sse.decorator.ts` | `Sse` (path fallback, method, options) | Tested |
| `modules/global.decorator.ts` | `Global` | Tested |
| `modules/module.decorator.ts` | `Module`, `validateModuleKeys`, own/inherited key handling | Tested |

#### Out-of-scope

- `core/index.ts`, `http/index.ts`, `modules/index.ts`: chỉ re-export.
- Các interface/type (`ControllerOptions`, `ParameterDecoratorOptions`,
  `ResponseDecoratorOptions`, `ParamData`, `RouteParamMetadata`, `SseOptions`,
  `ParamDecoratorEnhancer`, v.v.) bị xóa khi transpile và không có branch runtime.

### Bước 3-4 - CFG / C3 và test path

- Đã tách các điều kiện nguyên tử trong biểu thức ngắn mạch:
  - `applyDecorators`: `target instanceof Function && !descriptor`.
  - `Controller`: `isUndefined`, `isString || Array.isArray`, `path || defaultPath`,
    `Array.isArray(version)` và dedupe `Set`.
  - `flatten`: `flat.some(Array.isArray)` đệ quy và trường hợp không còn mảng lồng.
  - `UseGuards`/`UseInterceptors`/`UsePipes`/`UseFilters`: truthy check,
    `isFunction` vs method (`canActivate`/`intercept`/`transform`/`catch`), descriptor
    so với class target, validate lỗi và cộng dồn metadata.
  - `Inject`: `arguments.length`, `token || design:type`, `!type && !injectCallHasArguments`,
    `isUndefined(index)`, lọc property key cũ.
  - `Inject.mixin`: `Reflect.hasMetadata(PARAMTYPES_METADATA, mixinClass)`.
  - `createParamDecorator`: toàn bộ nhánh `isPipe`, `isNil(data) || !isPipe(data)`,
    `isDataOptions` (chỉ key `schema`/`pipes`, schema hợp lệ, pipes là mảng hợp lệ),
    merge options trong pipes, `finalSchema ??=`, spread `arg.pipes ?? []`, enhancers.
  - `assignMetadata`: `options !== null`, `typeof object`, `isParameterDecoratorOptions ||
    'data' in options`, `!('transform' in options)`, `legacyPipes.length === 0`,
    `pipes ?? []`, schema có/không.
  - `createPipesRouteParamDecorator`: `isNil(data) || isString(data)`, pipe-only data,
    nullish/string/object data, pipes có/không.
  - `Query`/`Body`/`Param`: options-first, property + options, property + pipe,
    pipe-only, skipped pipe, schema/pipes merge.
  - `RawBody`, `UploadedFile`, `UploadedFiles`, `Cookies`, `SignedCookies`:
    data/pipes nullish và pipe-instance-as-data.
  - `Response`: `options?.passthrough` true/false/undefined.
  - `RequestMapping`: default metadata, path rỗng, method falsy, path array, toàn bộ alias.
  - `Sse`: path rỗng/null và `options[METHOD_METADATA] ?? GET`.
  - `SseSignal`: request có/không có `SSE_ABORT_CONTROLLER`, controller có/không có signal.
  - `Module`: key hợp lệ, key không hợp lệ, thuộc tính kế thừa bị bỏ qua bởi `Object.hasOwn`.

- Có **1 nhánh infeasible** trong `route-params.decorator.ts:121`:
  `pipes ?? []` ở nhánh `hasParamData === false`. Nhánh này chỉ chạy khi `data` là pipe
  nhưng tham số `pipes` của helper nội bộ là `undefined`; mọi export public
  (`Query`/`Body`/`Param`/`UploadedFile`/`Cookies`/...) luôn truyền một mảng (kể cả mảng
  rỗng) nên không thể đạt tới từ API công khai. Nhánh `pipes ?? []` ở dòng 120 (data
  nullish/string với pipes undefined) đã được phủ.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/decorators/core/apply-decorators.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/bind.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/catch.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/controller.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/dependencies.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/exception-filters.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/inject.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/injectable.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/optional.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/set-metadata.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/use-guards.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/use-interceptors.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/use-pipes.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/core/version.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/create-route-param-metadata.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/header.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/http-code.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/redirect.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/render.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/request-mapping.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/route-params.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/sse-signal.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/http/sse.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/modules/global.decorator.spec.ts`
- `ai-generated-tests/packages/common/decorators/modules/module.decorator.spec.ts`

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/decorators --reporter=dot
```

Kết quả: **25 test files, 137 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/decorators --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/decorators`):

- Statements: **100%** (248/248)
- Branches: **99.39%** (163/164)
- Functions: **100%** (81/81)
- Lines: **100%** (245/245)
- 1 branch infeasible đã ghi nhận ở `route-params.decorator.ts:121`.

Chạy lại toàn bộ test AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **64 test files, 1194 tests passed, 0 failed**.

Giới hạn công cụ: `@vitest/coverage-v8` báo cáo **branch coverage**, không báo trực tiếp
C3. C3 được thiết kế thủ công bằng cách tách từng điều kiện nguyên tử và sinh input cho
cả hai kết quả; toàn bộ điều kiện khả thi trong module đều đã được kích hoạt T/F.

### Bước 7 - Trạng thái

- Module `packages/common/decorators`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 6 - `packages/common/exceptions`

### Bước 1 - Khảo sát project

- Module có 24 file production: `http.exception.ts`, `intrinsic.exception.ts`,
  `index.ts`, và 21 file exception con.
- Test hiện có: `packages/common/test/exceptions/*.spec.ts` (22 file).
- Baseline chạy trước khi sinh test:

```bash
npx vitest run packages/common/test/exceptions --reporter=dot
```

Kết quả baseline: **22 test files, 167 tests passed**.

- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật để đo coverage cho
  `packages/common/exceptions/**/*.ts`, loại `packages/common/exceptions/index.ts`.
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.

### Bước 2 - Phân loại hàm

#### In-scope (có runtime code)

| File production | Class / thành phần runtime | Status mặc định | Trạng thái |
| --- | --- | --- | --- |
| `http.exception.ts` | `HttpException` (constructor, `initCause`, `initErrorCode`, `initMessage`, `initName`, `getResponse`, `getStatus`, `createBody`, `getDescriptionFrom`, `getHttpExceptionOptionsFrom`, `extractDescriptionAndOptionsFrom`) | - | Tested |
| `intrinsic.exception.ts` | `IntrinsicException` | - | Tested |
| `bad-gateway.exception.ts` | `BadGatewayException` | 502 / `Bad Gateway` | Tested |
| `bad-request.exception.ts` | `BadRequestException` | 400 / `Bad Request` | Tested |
| `conflict.exception.ts` | `ConflictException` | 409 / `Conflict` | Tested |
| `forbidden.exception.ts` | `ForbiddenException` | 403 / `Forbidden` | Tested |
| `gateway-timeout.exception.ts` | `GatewayTimeoutException` | 504 / `Gateway Timeout` | Tested |
| `gone.exception.ts` | `GoneException` | 410 / `Gone` | Tested |
| `http-version-not-supported.exception.ts` | `HttpVersionNotSupportedException` | 505 / `HTTP Version Not Supported` | Tested |
| `im-a-teapot.exception.ts` | `ImATeapotException` | 418 / `I'm a teapot` | Tested |
| `internal-server-error.exception.ts` | `InternalServerErrorException` | 500 / `Internal Server Error` | Tested |
| `method-not-allowed.exception.ts` | `MethodNotAllowedException` | 405 / `Method Not Allowed` | Tested |
| `misdirected.exception.ts` | `MisdirectedException` | 421 / `Misdirected` | Tested |
| `not-acceptable.exception.ts` | `NotAcceptableException` | 406 / `Not Acceptable` | Tested |
| `not-found.exception.ts` | `NotFoundException` | 404 / `Not Found` | Tested |
| `not-implemented.exception.ts` | `NotImplementedException` | 501 / `Not Implemented` | Tested |
| `payload-too-large.exception.ts` | `PayloadTooLargeException` | 413 / `Payload Too Large` | Tested |
| `precondition-failed.exception.ts` | `PreconditionFailedException` | 412 / `Precondition Failed` | Tested |
| `request-timeout.exception.ts` | `RequestTimeoutException` | 408 / `Request Timeout` | Tested |
| `service-unavailable.exception.ts` | `ServiceUnavailableException` | 503 / `Service Unavailable` | Tested |
| `unauthorized.exception.ts` | `UnauthorizedException` | 401 / `Unauthorized` | Tested |
| `unprocessable-entity.exception.ts` | `UnprocessableEntityException` | 422 / `Unprocessable Entity` | Tested |
| `unsupported-media-type.exception.ts` | `UnsupportedMediaTypeException` | 415 / `Unsupported Media Type` | Tested |

#### Out-of-scope

- `index.ts`: chỉ re-export.
- Interface/type `HttpExceptionOptions`, `DescriptionAndOptions`: type-only, không có branch runtime.

### Bước 3-4 - CFG / C3 và test path

- `HttpException.initCause`: `this.options?.cause` được đánh giá T/F, gồm cả options
  `undefined`, `{}`, `cause` truthy, `cause` null/0.
- `HttpException.initErrorCode`: `this.options?.errorCode` T/F, gồm errorCode rỗng.
- `HttpException.initMessage`:
  - `isString(response)` T/F.
  - `isObject(response)` T/F; khi T, `isString(response.message)` T/F.
  - `this.constructor` T/F.
  - regex match có kết quả (join) và không có kết quả (`?? 'Error'`).
- `HttpException.createBody`:
  - `!arg0` T/F (null, `''`, `0` so với string/array/number/object).
  - `isString(arg0) || Array.isArray(arg0) || isNumber(arg0)` với short-circuit:
    string, array, number truthy, object.
  - `if (errorCode)` T/F ở cả nhánh `!arg0` và nhánh message scalar.
- `HttpException.getDescriptionFrom`: `isString` T/F, `descriptionOrOptions?.description`
  với object có/không description và nullish.
- `HttpException.getHttpExceptionOptionsFrom`: `isString` T/F, object giữ nguyên,
  nullish trả null.
- `HttpException.extractDescriptionAndOptionsFrom`: hai ternary `isString` T/F,
  options có description, `{}` và nullish.
- Mỗi exception con:
  - destructuring `description = default` khi options rỗng/không description.
  - `httpExceptionOptions?.errorCode` với options nullish, không errorCode, có errorCode.
  - `createBody` với `objectOrError` truthy/falsy, string/object/number.
  - cause truthy/falsy, errorCode rỗng.
- Không có path infeasible trong module này.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/exceptions/http.exception.spec.ts`
- `ai-generated-tests/packages/common/exceptions/intrinsic.exception.spec.ts`
- 21 file tương ứng cho các exception con:
  `bad-gateway`, `bad-request`, `conflict`, `forbidden`, `gateway-timeout`, `gone`,
  `http-version-not-supported`, `im-a-teapot`, `internal-server-error`,
  `method-not-allowed`, `misdirected`, `not-acceptable`, `not-found`,
  `not-implemented`, `payload-too-large`, `precondition-failed`, `request-timeout`,
  `service-unavailable`, `unauthorized`, `unprocessable-entity`,
  `unsupported-media-type` (hậu tố `.exception.spec.ts`).
- `ai-generated-tests/packages/common/exceptions/exception-test.helper.ts`: helper
  dùng chung cho các exception con, không phải file test runner.

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/exceptions --reporter=dot
```

Kết quả: **23 test files, 246 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/exceptions --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/exceptions`):

- Statements: **100%** (80/80)
- Branches: **100%** (75/75)
- Functions: **100%** (32/32)
- Lines: **100%** (80/80)
- 22 file fully covered; 1 file rỗng (`IntrinsicException`) được v8 bỏ qua.
- Không có branch infeasible.

Chạy lại toàn bộ test AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **87 test files, 1440 tests passed, 0 failed**.

Giới hạn công cụ: `@vitest/coverage-v8` báo cáo **branch coverage**, không báo trực tiếp
C3. C3 được thiết kế thủ công bằng cách tách từng điều kiện nguyên tử và sinh input cho
cả hai kết quả; toàn bộ điều kiện khả thi trong module đều đã được kích hoạt T/F.

### Bước 7 - Trạng thái

- Module `packages/common/exceptions`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 7 - `packages/common/enums`

### Bước 1 - Khảo sát project

- Module có 6 file production, 5 file chứa enum runtime và 1 file `index.ts` re-export:
  - `http-status.enum.ts` — `HttpStatus` (55 thành viên)
  - `request-method.enum.ts` — `RequestMethod` (17 thành viên)
  - `route-paramtypes.enum.ts` — `RouteParamtypes` (16 thành viên)
  - `shutdown-signal.enum.ts` — `ShutdownSignal` (11 thành viên)
  - `version-type.enum.ts` — `VersioningType` (4 thành viên)
  - `index.ts` — chỉ re-export, không có logic runtime.
- Không có test có sẵn dành riêng cho `packages/common/enums` trong
  `packages/common/test`.
- Baseline AI suite trước module: **87 test files, 1440 tests passed**.
- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật để đo coverage cho
  `packages/common/enums/**/*.ts`, loại `packages/common/enums/index.ts`.
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.

### Bước 2 - Phân loại hàm

#### In-scope

| Enum | Runtime initializer | Số thành viên | Trạng thái |
| --- | --- | --- | --- |
| `HttpStatus` | IIFE khởi tạo enum | 55 | Tested |
| `RequestMethod` | IIFE khởi tạo enum | 17 | Tested |
| `RouteParamtypes` | IIFE khởi tạo enum | 16 | Tested |
| `ShutdownSignal` | IIFE khởi tạo enum | 11 | Tested |
| `VersioningType` | IIFE khởi tạo enum | 4 | Tested |

- Tổng: **5 runtime initializer**, **103 enum member values**.

#### Out-of-scope

- `index.ts`: chỉ re-export, không có branch hay logic runtime.
- Type-only declarations: không có.

### Bước 3-4 - CFG / C3 và test path

- Các enum không chứa câu lệnh điều kiện, vòng lặp, `switch`, toán tử logic hay
  short-circuit. Vì vậy mỗi enum có:
  - **0 decision node**.
  - **1 đường độc lập** duy nhất: entry → khởi tạo toàn bộ thành viên → exit.
  - **0 branch True/False** cần phủ.
- C3 không áp dụng cho control flow của enum; mọi thành viên và reverse mapping do
  TypeScript sinh ra được thực thi ngay khi import enum.
- Test path duy nhất được kích hoạt bằng cách import từng enum và đọc toàn bộ thành viên.
- Không có path infeasible trong module này.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/enums/http-status.enum.spec.ts`
- `ai-generated-tests/packages/common/enums/request-method.enum.spec.ts`
- `ai-generated-tests/packages/common/enums/route-paramtypes.enum.spec.ts`
- `ai-generated-tests/packages/common/enums/shutdown-signal.enum.spec.ts`
- `ai-generated-tests/packages/common/enums/version-type.enum.spec.ts`

- Mỗi file dùng Parameterized Test (`it.each`) cho từng thành viên enum.

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/enums --reporter=dot
```

Kết quả: **5 test files, 103 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/enums --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/enums`):

- Statements: **100%** (108/108)
- Branches: **100%** (0/0 — enum không có branch)
- Functions: **100%** (5/5)
- Lines: **100%** (108/108)
- 5 file fully covered.
- Không có branch infeasible.

Chạy lại toàn bộ test AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **92 test files, 1543 tests passed, 0 failed**.

Giới hạn công cụ: `@vitest/coverage-v8` báo cáo **branch coverage**, không báo trực tiếp
C3. Với module enum, C3 không áp dụng vì không có decision node; v8 ghi nhận 0/0
branch và báo 100%. Statements/lines/functions đều đạt 100%.

### Bước 7 - Trạng thái

- Module `packages/common/enums`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 8 - `packages/common/serializer`

### Bước 1 - Khảo sát project

- Module có 8 file production:
  - `class-serializer.constants.ts` — hằng số `CLASS_SERIALIZER_OPTIONS`.
  - `class-serializer.interfaces.ts` — interface type definitions.
  - `decorators/serialize-options.decorator.ts` — decorator function `SerializeOptions`.
  - `decorators/index.ts` — re-export.
  - `standard-schema-serializer.interfaces.ts` — interface type definitions.
  - `index.ts` — re-export.
  - `class-serializer.interceptor.ts` — interceptor `ClassSerializerInterceptor`.
  - `standard-schema-serializer.interceptor.ts` — interceptor `StandardSchemaSerializerInterceptor`.
- Test có sẵn của module trong repo: `packages/common/test/serializer/**/*.spec.ts` (2 test files, 52 passed).
- Baseline AI suite trước module: **92 test files, 1543 tests passed**.
- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật:
  - include: `packages/common/serializer/**/*.ts`
  - exclude: `packages/common/serializer/index.ts`, `packages/common/serializer/decorators/index.ts`, `packages/common/serializer/**/*.interfaces.ts`
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.

### Bước 2 - Phân loại hàm

#### In-scope

| File production | Hàm / Class / Method | Trạng thái |
| --- | --- | --- |
| `class-serializer.constants.ts` | `CLASS_SERIALIZER_OPTIONS` | Tested |
| `decorators/serialize-options.decorator.ts` | `SerializeOptions` | Tested |
| `class-serializer.interceptor.ts` | `ClassSerializerInterceptor.constructor` | Tested |
| `class-serializer.interceptor.ts` | `ClassSerializerInterceptor.intercept` | Tested |
| `class-serializer.interceptor.ts` | `ClassSerializerInterceptor.serialize` | Tested |
| `class-serializer.interceptor.ts` | `ClassSerializerInterceptor.transformToPlain` | Tested |
| `class-serializer.interceptor.ts` | `ClassSerializerInterceptor.getContextOptions` | Tested |
| `standard-schema-serializer.interceptor.ts` | `StandardSchemaSerializerInterceptor.constructor` | Tested |
| `standard-schema-serializer.interceptor.ts` | `StandardSchemaSerializerInterceptor.intercept` | Tested |
| `standard-schema-serializer.interceptor.ts` | `StandardSchemaSerializerInterceptor.serialize` | Tested |
| `standard-schema-serializer.interceptor.ts` | `StandardSchemaSerializerInterceptor.transformToPlain` | Tested |
| `standard-schema-serializer.interceptor.ts` | `StandardSchemaSerializerInterceptor.getContextOptions` | Tested |

#### Out-of-scope

- `index.ts`, `decorators/index.ts`: chỉ re-export.
- `class-serializer.interfaces.ts`, `standard-schema-serializer.interfaces.ts`: interface / type declaration, bị xóa khi transpile.

#### Indirect dependency

- `Reflector`: mock qua `getAllAndOverride` và `getAll`.
- `ExecutionContext`: mock qua `getHandler()` và `getClass()`.
- `CallHandler`: mock qua `handle()`.
- `StreamableFile`: dùng thật từ `packages/common/file-stream`.
- `isStreamingBody`: dùng thật từ `packages/common/utils` (kiểm tra `Readable`, `Response`, async iterator).
- `class-transformer`: mock package với `classToPlain` và `plainToInstance`.
- `@standard-schema/spec`: schema stub tuân thủ `~standard.validate`.

### Bước 3-4 - CFG / C3 và test path

- **`class-serializer.constants.ts`**:
  - `CLASS_SERIALIZER_OPTIONS`: 0 decision node, 1 independent path.
- **`SerializeOptions`**:
  - 0 decision node, 1 independent path. Gọi `SetMetadata(CLASS_SERIALIZER_OPTIONS, options)`. Kiểm thử lưu metadata trên class và method descriptor.
- **`ClassSerializerInterceptor`**:
  - `constructor`: 2 nút quyết định (1c1: `defaultOptions?.transformerPackage != null`, 2: `!(pendingClassTransformer instanceof Promise)`). 3 đường độc lập. Đã phủ 1c1(T/F), 2(T/F) với sync package, Promise package và fallback `loadPackage`.
  - `intercept`: 0 nút quyết định trong thân hàm, 1 đường độc lập qua `map(res => this.serialize(res, options))`.
  - `serialize`: 4 nút quyết định sau khi tách short-circuit:
    - 1c1: `!isObject(response)` (T: primitive null/undefined/string/number/boolean/symbol -> return response; F: tiếp tục).
    - 1c2: `response instanceof StreamableFile` (T: return response; F: tiếp tục).
    - 1c3: `isStreamingBody(response)` (T: Readable/Response/asyncIterator -> return response; F: tiếp tục).
    - 2: `Array.isArray(response)` (T: response.map; F: this.transformToPlain).
    - 5 đường độc lập, toàn bộ điều kiện con và decision tổng thể đạt cả True và False (C3 = 100%).
  - `transformToPlain`: 3 nút quyết định:
    - 1: `!plainOrClass` (T: falsy return; F: tiếp tục).
    - 2: `!options.type` (T: classToPlain(plainOrClass); F: tiếp tục).
    - 3: `plainOrClass instanceof options.type` (T: classToPlain(plainOrClass); F: plainToInstance rồi classToPlain).
    - 4 đường độc lập, toàn bộ nhánh True/False đều được thực thi (C3 = 100%).
  - `getContextOptions`: 0 nút quyết định, gọi `reflector.getAllAndOverride`. Đã kiểm thử trường hợp trả về options và undefined.
- **`StandardSchemaSerializerInterceptor`**:
  - `constructor`: 0 nút quyết định, 1 đường độc lập.
  - `intercept`: fallback nullish coalescing `contextOptions?.schema ?? defaultOptions.schema` và `validateOptions`. Đã phủ các nhánh ưu tiên context và fallback default.
  - `serialize`: 5 nút quyết định sau khi tách short-circuit:
    - 1c1: `!schema` (T: return response; F: tiếp tục).
    - 1c2: `!isObject(response)` (T: return response; F: tiếp tục).
    - 1c3: `response instanceof StreamableFile` (T: return response; F: tiếp tục).
    - 1c4: `isStreamingBody(response)` (T: return response; F: tiếp tục).
    - 2: `Array.isArray(response)` (T: Promise.all map; F: this.transformToPlain).
    - 6 đường độc lập, toàn bộ điều kiện con và decision tổng thể đạt cả True và False (C3 = 100%).
  - `transformToPlain`: 2 nút quyết định:
    - 1: `!plainOrClass` (T: return; F: tiếp tục).
    - 2: `result.issues` (T: throw Error formatting issues; F: return result.value).
    - 3 đường độc lập, C3 = 100%.
  - `getContextOptions`: 4 nút quyết định:
    - 1c1: `!handlerOptions` (T: trả về classOptions ?? undefined; F: tiếp tục).
    - 1c2: `!classOptions` (T: trả về handlerOptions; F: cả hai đều có).
    - 2c1: `handlerOptions.schema ?? classOptions.schema` (T: handler; F: class).
    - 3c1: `handlerOptions.validateOptions ?? classOptions.validateOptions` (T: handler; F: class).
    - 5 đường độc lập, phủ đủ 7 biến thể cấu hình (undefined/undefined, undefined/defined, defined/undefined, merge override cả hai, override schema only, override validateOptions only, neither).

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/serializer/class-serializer.constants.spec.ts`
- `ai-generated-tests/packages/common/serializer/decorators/serialize-options.decorator.spec.ts`
- `ai-generated-tests/packages/common/serializer/class-serializer.interceptor.spec.ts`
- `ai-generated-tests/packages/common/serializer/standard-schema-serializer.interceptor.spec.ts`

- Toàn bộ file sử dụng Parameterized Test (`it.each`, `describe.each`).

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/serializer --reporter=dot
```

Kết quả: **4 test files, 83 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/serializer --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/serializer`):

- Statements: **100%**
- Branches: **100%**
- Functions: **100%**
- Lines: **100%**
- 4 file fully covered.
- Số path/nhánh infeasible: **0**.

Chạy lại toàn bộ test AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **96 test files, 1626 tests passed, 0 failed**.

Giới hạn công cụ: `@vitest/coverage-v8` đo branch coverage, statement coverage, function coverage và line coverage (toàn bộ đạt 100%). C3 (Condition Coverage) với việc đánh giá độc lập mọi điều kiện nguyên tử (atomic condition) và quyết định tổng thể (overall decision) ở cả hai trạng thái True/False đã được thiết kế và kiểm chứng qua 83 unit test paths độc lập.

### Bước 7 - Trạng thái

- Module `packages/common/serializer`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 9 - `packages/common/file-stream`

### Bước 1 - Khảo sát project

- Module có 5 file production:
  - `streamable-file.ts` — class `StreamableFile`.
  - `index.ts` — re-export.
  - `interfaces/streamable-options.interface.ts` — interface `StreamableFileOptions`.
  - `interfaces/streamable-handler-response.interface.ts` — interface `StreamableHandlerResponse`.
  - `interfaces/index.ts` — re-export.
- Test có sẵn của module trong repo: `packages/common/test/file-stream/streamable-file.spec.ts` (1 test file, 26 passed).
- Baseline AI suite trước module: **96 test files, 1626 tests passed**.
- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật:
  - include: `packages/common/file-stream/**/*.ts`
  - exclude: `packages/common/file-stream/index.ts`, `packages/common/file-stream/interfaces/**/*.ts`
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.

### Bước 2 - Phân loại hàm

#### In-scope

| File production | Hàm / Class / Method | Trạng thái |
| --- | --- | --- |
| `streamable-file.ts` | `StreamableFile.constructor` | Tested |
| `streamable-file.ts` | `StreamableFile.getStream` | Tested |
| `streamable-file.ts` | `StreamableFile.getHeaders` | Tested |
| `streamable-file.ts` | `StreamableFile.errorHandler` (getter) | Tested |
| `streamable-file.ts` | `StreamableFile.setErrorHandler` | Tested |
| `streamable-file.ts` | `StreamableFile.errorLogger` (getter) | Tested |
| `streamable-file.ts` | `StreamableFile.setErrorLogger` | Tested |
| `streamable-file.ts` | `StreamableFile.handleError` (default handler) | Tested |
| `streamable-file.ts` | `StreamableFile.logError` (default logger) | Tested |

#### Out-of-scope

- `index.ts`, `interfaces/index.ts`: chỉ re-export.
- `interfaces/streamable-options.interface.ts`, `interfaces/streamable-handler-response.interface.ts`: TypeScript interface, không chứa logic thực thi hay nhánh điều kiện runtime.

#### Indirect dependency

- `Readable`: stream từ Node.js core.
- `types.isUint8Array`: hàm kiểm tra type từ `util` core Node.js.
- `HttpStatus`: enum mã HTTP từ `packages/common/enums`.
- `Logger`: service ghi log từ `packages/common/services`.
- `isFunction`: hàm tiện ích kiểm tra function từ `packages/common/utils`.

### Bước 3-4 - CFG / C3 và test path

- **`StreamableFile.constructor`**:
  - 5 nút quyết định sau khi tách:
    - 1: `types.isUint8Array(bufferOrReadStream)` (T: bọc Readable, auto-length; F: tiếp tục).
    - 1_sub: `options.length != null` (T: giữ options.length; F: lấy buffer.length).
    - 2c1: `bufferOrReadStream.pipe` (T: tiếp tục 2c2; F: không gán stream).
    - 2c2: `isFunction(bufferOrReadStream.pipe)` (T: gán stream; F: không gán stream).
    - 3: `isFunction(this.stream.on)` (T: gắn error listener; F: không gắn).
  - Đã phủ toàn bộ True/False cho 1, 1_sub, 2c1, 2c2, 3 (C3 = 100%).
- **`StreamableFile.getStream`**:
  - 0 nút quyết định, 1 đường độc lập trả về `this.stream`.
- **`StreamableFile.getHeaders`**:
  - 0 nút quyết định, destructuring default parameters (`type`, `disposition`, `length`). Đã kiểm thử các tổ hợp giá trị mặc định và giá trị tùy biến.
- **`StreamableFile.errorHandler` / `setErrorHandler`**:
  - 0 nút quyết định, getter và setter (chaining fluent interface `return this`).
- **`StreamableFile.errorLogger` / `setErrorLogger` / `logError`**:
  - 0 nút quyết định, getter, setter và default logger gọi `this.logger.error`.
- **`StreamableFile.handleError` (default)**:
  - 4 nút quyết định sau khi tách:
    - 1: `res.destroyed` (T: early return; F: tiếp tục).
    - 2: `res.headersSent` (T: xử lý destroy/end; F: 400 Bad Request).
    - 3c1: `isFunction(res.destroy)` (T: kiểm tra 3c2; F: res.end()).
    - 3c2: `!this.stream?.readableEnded` (T: res.destroy(); F: res.end()).
  - 5 đường độc lập, toàn bộ các điều kiện con và decision tổng thể đạt cả True và False (C3 = 100%).

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/file-stream/streamable-file.spec.ts`
- Toàn bộ file sử dụng Parameterized Test (`describe.each`, `it.each`).

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/file-stream --reporter=dot
```

Kết quả: **1 test file, 36 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/file-stream --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/file-stream`):

- Statements: **100%**
- Branches: **100%**
- Functions: **100%**
- Lines: **100%**
- 1 file fully covered.
- Số path/nhánh infeasible: **0**.

Chạy lại toàn bộ test AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **97 test files, 1662 tests passed, 0 failed**.

Giới hạn công cụ: `@vitest/coverage-v8` đo branch coverage, statement coverage, function coverage và line coverage (toàn bộ đạt 100%). C3 (Condition Coverage) với việc đánh giá độc lập mọi điều kiện nguyên tử (atomic condition) và quyết định tổng thể (overall decision) ở cả hai trạng thái True/False đã được thiết kế và kiểm chứng qua 36 unit test paths độc lập.

### Bước 7 - Trạng thái

- Module `packages/common/file-stream`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 10 - `packages/common/module-utils`

### Bước 1 - Khảo sát project

- Module có 10 file production:
  - `constants.ts` — các hằng số cấu hình module builder.
  - `configurable-module.builder.ts` — class `ConfigurableModuleBuilder`.
  - `utils/generate-options-injection-token.util.ts` — hàm `generateOptionsInjectionToken`.
  - `utils/get-injection-providers.util.ts` — hàm `getInjectionProviders`, `isOptionalFactoryDependency`, `mapInjectToTokens`.
  - `utils/index.ts` — re-export utils.
  - `index.ts` — re-export.
  - `interfaces/*.ts` — interface type definitions (3 files).
  - `interfaces/index.ts` — re-export interfaces.
- Test có sẵn của module trong repo: `packages/common/test/module-utils/**/*.spec.ts` (2 test files, 9 passed).
- Baseline AI suite trước module: **97 test files, 1662 tests passed**.
- Cấu hình `ai-generated-tests/vitest.config.mts` được cập nhật:
  - include: `packages/common/module-utils/**/*.ts`
  - exclude: `packages/common/module-utils/index.ts`, `packages/common/module-utils/utils/index.ts`, `packages/common/module-utils/interfaces/**/*.ts`
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.

### Bước 2 - Phân loại hàm

#### In-scope

| File production | Hàm / Class / Method | Trạng thái |
| --- | --- | --- |
| `constants.ts` | `DEFAULT_METHOD_KEY`, `DEFAULT_FACTORY_CLASS_METHOD_KEY`, `ASYNC_METHOD_SUFFIX`, `CONFIGURABLE_MODULE_ID`, `ASYNC_OPTIONS_METADATA_KEYS` | Tested |
| `utils/generate-options-injection-token.util.ts` | `generateOptionsInjectionToken` | Tested |
| `utils/get-injection-providers.util.ts` | `isOptionalFactoryDependency`, `mapInjectToTokens`, `getInjectionProviders` | Tested |
| `configurable-module.builder.ts` | `ConfigurableModuleBuilder.constructor` | Tested |
| `configurable-module.builder.ts` | `ConfigurableModuleBuilder.setExtras` | Tested |
| `configurable-module.builder.ts` | `ConfigurableModuleBuilder.setClassMethodName` | Tested |
| `configurable-module.builder.ts` | `ConfigurableModuleBuilder.setFactoryMethodName` | Tested |
| `configurable-module.builder.ts` | `ConfigurableModuleBuilder.build` | Tested |
| `configurable-module.builder.ts` | `ConfigurableModuleBuilder.constructInjectionTokenString` | Tested |
| `configurable-module.builder.ts` | `ConfigurableModuleBuilder.createTypeProxy` | Tested |
| `configurable-module.builder.ts` | `InternalModuleClass[staticMethodKey]` | Tested |
| `configurable-module.builder.ts` | `InternalModuleClass[asyncMethodKey]` | Tested |
| `configurable-module.builder.ts` | `InternalModuleClass.omitExtras` | Tested |
| `configurable-module.builder.ts` | `InternalModuleClass.extractExtrasFromAsyncOptions` | Tested |
| `configurable-module.builder.ts` | `InternalModuleClass.createAsyncProviders` | Tested |
| `configurable-module.builder.ts` | `InternalModuleClass.createAsyncOptionsProvider` | Tested |

#### Out-of-scope

- `index.ts`, `utils/index.ts`, `interfaces/index.ts`: chỉ re-export.
- `interfaces/*.ts`: TypeScript interface/types thuần, không có runtime logic.

#### Indirect dependency

- `randomStringGenerator`: dùng thật từ `packages/common/utils`.
- `isUndefined`, `isFunction`: dùng thật từ `packages/common/utils`.
- `Logger`: dùng thật từ `packages/common/services`.

### Bước 3-4 - CFG / C3 và test path

- **`constants.ts`**:
  - Toàn bộ hằng số kiểm tra giá trị chính xác, 0 decision node, 1 independent path.
- **`generateOptionsInjectionToken`**:
  - 0 decision node, 1 independent path. Đã kiểm tra tính duy nhất và định dạng token.
- **`getInjectionProviders` & helper `isOptionalFactoryDependency`**:
  - `isOptionalFactoryDependency`: 3 điều kiện con (`!isUndefined(value.token)`, `!isUndefined(value.optional)`, `!(value as any).prototype`). Đã bao phủ đầy đủ các nhánh True/False độc lập cho từng điều kiện con.
  - Vòng lặp `while (search.length > 0)`: 0 vòng lặp và >= 1 vòng lặp.
  - Bộ lọc: `!result.includes(p)` (ngăn vòng lặp alias vô tận và trùng lặp), `search.includes(p)` (class token), `search.includes(p.provide)` (custom token).
  - `flatMap`: `useExisting !== undefined` (kể cả empty string), fallback `useFactory` `inject` và fallback `[]`. Đạt 100% C3.
- **`ConfigurableModuleBuilder`**:
  - `constructor`: nhánh copy từ `parentBuilder` và nhánh top-level.
  - `build`:
    - `staticMethodKey ??= DEFAULT_METHOD_KEY` (T/F).
    - `factoryClassMethodKey ??= DEFAULT_FACTORY_CLASS_METHOD_KEY` (T/F).
    - `optionsInjectionToken ??= moduleName ? construct : generate` (phủ cả 3 nhánh: token được truyền vào, sinh từ moduleName, và sinh ngẫu nhiên).
    - `transformModuleDefinition ??= def => def` (T/F).
    - `createTypeProxy`: ném `Error` chính xác khi truy cập thuộc tính trên proxy type.
  - `InternalModuleClass[staticMethodKey]`:
    - `alwaysTransient`: True (thêm `CONFIGURABLE_MODULE_ID`) / False (không thêm).
    - `omitExtras`: `extras` undefined (trả về input) / `extras` defined (lọc bỏ các key thuộc extras).
  - `InternalModuleClass[asyncMethodKey]`:
    - `alwaysTransient`: True / False.
    - `imports`: có imports / fallback `[]`.
    - `extractExtrasFromAsyncOptions`: `extras` undefined (trả về `{}`) / `extras` defined (lọc bỏ `ASYNC_OPTIONS_METADATA_KEYS`).
    - `createAsyncProviders` & `createAsyncOptionsProvider`:
      - `useFactory`: có `inject` + `provideInjectionTokensFrom` / có `inject` only / không có `inject` (fallback `[]`).
      - `useExisting`: ủy quyền sang existing token và gọi hàm factory khi invoke.
      - `useClass`: sinh useClass provider + async options provider ủy quyền. Đạt 100% C3.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/common/module-utils/constants.spec.ts`
- `ai-generated-tests/packages/common/module-utils/utils/generate-options-injection-token.util.spec.ts`
- `ai-generated-tests/packages/common/module-utils/utils/get-injection-providers.util.spec.ts`
- `ai-generated-tests/packages/common/module-utils/configurable-module.builder.spec.ts`

- Toàn bộ file sử dụng Parameterized Test (`describe.each`, `it.each`).

### Bước 6 - Kết quả thực thi và coverage

Lệnh chạy test AI sinh cho module:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/module-utils --reporter=dot
```

Kết quả: **4 test files, 48 tests passed, 0 failed**.

Lệnh đo coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common/module-utils --coverage
```

Kết quả coverage (v8, chỉ cho `packages/common/module-utils`):

- Statements: **100%**
- Branches: **100%**
- Functions: **100%**
- Lines: **100%**
- 4 file fully covered.
- Số path/nhánh infeasible: **0**.

Chạy lại toàn bộ test AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **101 test files, 1710 tests passed, 0 failed**.

Giới hạn công cụ: `@vitest/coverage-v8` đo branch coverage, statement coverage, function coverage và line coverage (toàn bộ đạt 100%). C3 (Condition Coverage) với việc đánh giá độc lập mọi điều kiện nguyên tử (atomic condition) và quyết định tổng thể (overall decision) ở cả hai trạng thái True/False đã được thiết kế và kiểm chứng qua 48 unit test paths độc lập.

### Bước 7 - Trạng thái

- Module `packages/common/module-utils`: **hoàn tất**.
- Số hàm bị chặn: **0**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test.

## Module 12 - `packages/platform-socket.io`

### Bước 1 - Khảo sát project

- Test runner: Vitest `5.1.0` (root `vitest.config.mts`, globals, alias `@nestjs/*`, setup `reflect-metadata`).
- Test hiện có của module: `packages/platform-socket.io/test/**/*.spec.ts` (2 file, 15 test).
- Baseline chạy trước khi sinh test:

```bash
node node_modules/vitest/vitest.mjs run packages/platform-socket.io --reporter=dot
```

Kết quả baseline: **2 test files, 15 tests passed, 0 failed**.

- Lưu ý môi trường: `node_modules/.bin` không tồn tại nên `npx vitest` lỗi
  `vitest is not recognized`; gọi trực tiếp entrypoint `node node_modules/vitest/vitest.mjs`
  cho kết quả tương đương và không sửa file build/dependency nào.
- Cấu hình test AI sinh: `ai-generated-tests/vitest.config.mts` (chỉ include `ai-generated-tests/**/*.spec.ts`).

### Bước 2 - Phân loại hàm

#### In-scope

| File production | Hàm / method | Trạng thái |
| --- | --- | --- |
| `adapters/io-adapter.ts` | `constructor` | Tested |
| `adapters/io-adapter.ts` | `create` | Tested |
| `adapters/io-adapter.ts` | `createIOServer` | Tested |
| `adapters/io-adapter.ts` | `bindMessageHandlers` | Tested |
| `adapters/io-adapter.ts` | `mapPayload` | Tested |
| `adapters/io-adapter.ts` | `bindClientDisconnect` | Tested |
| `adapters/io-adapter.ts` | `close` | Tested |
| `utils/merge-map-bounded.util.ts` | `mergeMapBounded` (operator + `drain`) | Tested |

#### Out-of-scope

- `index.ts`, `adapters/index.ts`: chỉ re-export.
- `Readme.md`, `package.json`, `tsconfig*.json`: không có logic thực thi.
- Type `IoAdapterOptions`: type-only.

#### Indirect dependency

- `@nestjs/websockets` (`AbstractWsAdapter`): dùng thật; `super.close()` dùng `server.close`.
- `@nestjs/common/internal` (`isFunction`, `isNil`) và `Logger`: dùng thật.
- `socket.io` (`Server`): thay bằng stub trong test (không mở port thật, không gắn HTTP server thật).
- `rxjs`: dùng thật (`defer`, `fromEvent`, `share`, `first`, `filter`, `map`, `takeUntil`, `catchError`, `EMPTY`).

### Bước 3-4 - CFG / C3 và test path

Quy ước: mỗi điều kiện con là một nút quyết định riêng, short-circuit được tôn trọng.

- **`constructor`** — `options?.maxConcurrentMessages ?? DEFAULT_MAX_CONCURRENT_MESSAGES`
  - 1 điều kiện: giá trị nullish (T: bỏ options/`{}`; F: `0`, `5`, `Infinity`). `0` chứng minh `??` không dùng truthiness.
- **`create`**
  - Nút 1 `!options`: T (không truyền) / F (truyền `{}`).
  - Nút 2 `server && namespace && isFunction(server.of)`: `2c1` server T/F, `2c2` namespace T/F, `2c3` `isFunction(server.of)` T/F.
  - Nút 3 `namespace ? ... : ...`: T/F.
  - Các path đã phủ: `1(T)`; `1(F),2c1(F)`; `2c1(F),3(T)`; `2c1(T),2c2(T),2c3(T)`; `2c1(T),2c2(T),2c3(F),3(T)`; `2c1(T),2c2(F)`; `2c2(F),3(F)` (namespace rỗng).
- **`createIOServer`**
  - Nút 1 `this.httpServer && port === 0`: `1c1` T/F, `1c2` T/F (khi `1c1(F)` thì `1c2` bị bỏ qua).
- **`bindMessageHandlers`**
  - Nút 1 `!disconnect$`: T (lần đầu) / F (cùng socket, lần hai).
  - Nút 2 `!isNil(response)`: T/F (response `undefined`/`null` bị lọc).
  - Catch của `catchError` (transform/callback throw) và `catch` của subscriber (emit/ack throw).
  - Nút 3 `response.event`: T (emit event) / F.
  - Nút 4 `!isAckHandledManually && isFunction(ack)`: `4c1` T/F, `4c2` T/F (T: ack là function; F: payload không có ack).
  - Nút 5 `while` ngầm của `handlers.forEach`: 0 handler và nhiều handler.
- **`mapPayload`**
  - Nút 1 `!Array.isArray(payload)`: T/F.
  - Nút 2 `isFunction(payload)`: T/F.
  - Nút 3 `isAck = isFunction(lastElement)`: T/F.
  - Nút 4 `size === 1`: T (một value + ack) / F (nhiều value + ack, hoặc chỉ ack).
- **`bindClientDisconnect`** — 0 nút quyết định, 1 path (đăng ký `once('disconnect')` và chuyển reason).
- **`close`**
  - Nút 1 `this.forceCloseConnections && server.httpServer === this.httpServer`: `1c1` T/F, `1c2` T/F.
  - Nhánh `super.close`: `server && isFunction(server.close)` T/F.
- **`mergeMapBounded`** (`drain` và callback)
  - Nút 1 `if (isDraining)`: T (inner complete đồng bộ gọi lại `drain`) / F.
  - Nút 2 `while (head && active < concurrent && !subscriber.closed)`: `2c1` T/F, `2c2` T/F, `2c3` T/F.
  - Nút 3 `if (onBacklog && isBacklogged !== !!head)`: `3c1` T/F, `3c2` T (đổi trạng thái) / F (không đổi).
  - Nút 4 `if (isSourceComplete && !head && active === 0)`: `4c1` T/F, `4c2` T/F, `4c3` T/F.
  - Nút 5 `tail = head ? ... : ...`: T (đã có phần tử chờ) / F (hàng đợi rỗng).
  - Nhánh error: `project` throw và source error.
  - `2c3(F)` được phủ bằng cách unsubscribe ngay trong `project`: vòng `while` kiểm tra lại và thấy `subscriber.closed === true`.
  - Số path infeasible: **0**.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/platform-socket.io/adapters/io-adapter.spec.ts`
- `ai-generated-tests/packages/platform-socket.io/utils/merge-map-bounded.util.spec.ts`

- Sử dụng Parameterized Test (`it.each`) cho constructor, `create`, `createIOServer`, `mapPayload`, `mergeMapBounded`.
- `socket.io.Server` được stub bằng `vi.mock` để đo cả hai nhánh của `createIOServer` mà không mở cổng mạng.

### Bước 6 - Kết quả thực thi và coverage

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/platform-socket.io --reporter=dot
```

Kết quả: **2 test files, 53 tests passed, 0 failed, 0 lỗi biên dịch/import**.

Coverage:

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/platform-socket.io --coverage --coverage.include="packages/platform-socket.io/**/*.ts" --coverage.reporter=text
```

Kết quả (`@vitest/coverage-v8`):

- Statements: **100%** (80/80)
- Branches: **100%** (51/51)
- Functions: **100%** (26/26)
- Lines: **100%** (78/78)
- 2 file fully covered: `adapters/io-adapter.ts`, `utils/merge-map-bounded.util.ts`.

Giới hạn công cụ: `@vitest/coverage-v8` không báo cáo C3 theo nghĩa atomic-condition trực tiếp.
Số liệu trên là branch/statement/function/line coverage; các cặp T/F của từng điều kiện con
được thiết kế và ghi chú ngay trong tên test/nhóm test theo CFG ở trên.

Lưu ý khi chạy toàn bộ suite AI sinh:

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **108 test files, 1783 tests**, trong đó **3 test fail thuộc `platform-fastify`**
(`get-media-type-version.util.spec.ts`, `route-config.decorator.spec.ts`,
`route-constraints.decorator.spec.ts`, `route-schema.decorator.spec.ts`) — các file này
không thuộc module được chỉ định và không bị sửa bởi lần sinh test này.

### Bước 7 - Trạng thái

- Module `packages/platform-socket.io`: **hoàn tất**.
- Số hàm in-scope: **8/8 đã sinh test**, **0 bỏ qua**, **0 BLOCKED**.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test đã có.

## Module 11 - `packages/platform-fastify`

### Bước 1 - Khảo sát project

- Test runner của repo: `vitest` (`npm test` -> `vitest run`).
- Cấu hình gốc: `vitest.config.mts`; alias `@nestjs/*`, setup `reflect-metadata`.
- Test hiện có của module: `packages/platform-fastify/test/**/*.spec.ts`.
- Baseline chạy trước khi sinh test:

```bash
npx vitest run packages/platform-fastify/test --reporter=dot
```

Kết quả baseline: **22 test files, 355 tests passed, 0 failed**.

- Cấu hình riêng cho test AI sinh: `ai-generated-tests/vitest.config.mts`.
  Cấu hình chỉ include `ai-generated-tests/**/*.spec.ts`; coverage include
  `packages/platform-fastify/**/*.{ts,js}` và loại các file type-only
  (`interfaces/**`, `multipart/interfaces/**`, `index.ts`), test có sẵn (`test/**`)
  và file `*.spec.ts`/`*.test.ts`.
- Môi trường: cài dependency bằng
  `npm ci --ignore-scripts --no-audit --no-fund --legacy-peer-deps`
  (`npm ci` thường lỗi xung đột peer `graphql`, và Vitest chưa có trong `node_modules`).

### Bước 2 - Phân loại hàm

#### In-scope (đã sinh test)

| File production | Hàm/phương thức | Trạng thái |
| --- | --- | --- |
| `adapters/fastify-adapter.ts` | `FastifyAdapter`: constructor, `setOnRequestHook`, `setOnResponseHook`, `runLifecycleHook`, `init`, `listen`, `isValidPort`, toàn bộ HTTP verb (`get`/`post`/`head`/`delete`/`put`/`patch`/`options`/`search`/`query`/`propfind`/`proppatch`/`mkcol`/`copy`/`move`/`lock`/`unlock`/`all`), `applyVersionFilter`, `reply`, `status`, `end`, `render`, `redirect`, `setErrorHandler`, `setNotFoundHandler`, `getHttpServer`, `getInstance`, `register`, `useMultipart`, `inject`, `beforeClose`, `close`, `initHttpServer`, `useStaticAssets`, `setViewEngine`, `isHeadersSent`, `getHeader`, `setHeader`, `appendHeader`, các `getRequest*`, `enableCors`, `copyCorsHeadersToRaw`, `registerSecurityHook`, `registerParserMiddleware`, `useBodyParser`, `createMiddlewareFactory`, `runMiddleware`, `getType`, `isRouteOrderSensitive`, `getRouteMatchingOptions`, `use`, `mapException`, `isHttpFastifyError`, `registerWithPrefix`, `isNativeResponse`, các parser nội bộ, `registerMiddie`, `injectRouteOptions`, `requireNonEmptyParams`, `getTopLevelRouterOptions`, `sanitizeUrl`, `removeDuplicateSlashes`, `trimLastSlash`, `getPathFromRequestTarget`, `isRoutableRequestTarget`, `trackOpenConnections`, `closeOpenConnections` | Tested |
| `adapters/utils/get-media-type-version.util.ts` | `getMediaTypeVersion` | Tested |
| `constants.ts` | `FASTIFY_ROUTE_CONFIG_METADATA`, `FASTIFY_ROUTE_CONSTRAINTS_METADATA`, `FASTIFY_ROUTE_SCHEMA_METADATA` | Tested |
| `decorators/route-config.decorator.ts` | `RouteConfig` | Tested |
| `decorators/route-constraints.decorator.ts` | `RouteConstraints` | Tested |
| `decorators/route-schema.decorator.ts` | `RouteSchema` | Tested |
| `multipart/multipart/append-field.util.ts` | `appendField` | Tested |
| `multipart/multipart/multipart.constants.ts` | toàn bộ hằng số/exception map | Tested |
| `multipart/multipart/multipart.error.ts` | `MultipartError` (constructor, `getStatus`) | Tested |
| `multipart/multipart/multipart.parser.ts` | `resolveStorage`, `removeFiles`, `drainRequest`, `validateLimits`, `processMultipart`, `processStream` (gồm `storeFile`, `readingAhead`, `applyFileFilter`, `createRequestFile`) | Tested |
| `multipart/multipart/multipart.utils.ts` | `mergeMultipartOptions`, `transformException` | Tested |
| `multipart/multipart/multipart-interceptor.factory.ts` | `createMultipartInterceptor`, `createMultipartStreamInterceptor` | Tested |
| `multipart/storage/memory.storage.ts` | `memoryStorage` (`_handleFile`, `_removeFile`) | Tested |
| `multipart/storage/disk.storage.ts` | `diskStorage` (`_handleFile`, `_removeFile`, `getFilename`, `getDestination`) | Tested |
| `multipart/multipart.module.ts` | `MultipartModule.forRoot`, `forRootAsync` | Tested |
| `multipart/interceptors/*.ts` | `FileInterceptor`, `FilesInterceptor`, `AnyFilesInterceptor`, `FileFieldsInterceptor`, `NoFilesInterceptor`, `FileStreamInterceptor` | Tested |
| `multipart/files.constants.ts`, `multipart/multipart.constants.ts` | hằng số DI token/module id | Covered indirectly (được import bởi module/interceptor) |

#### Out-of-scope

- `index.ts`, các `index.ts` con: chỉ re-export.
- `interfaces/**`, `multipart/interfaces/**`: type-only, không có mã thực thi.
- `Readme.md`, `package.json`, `tsconfig*.json`: không có logic.
- Các test có sẵn `packages/platform-fastify/test/**`: không sửa, chỉ dùng làm baseline.

#### Indirect dependency

- `@nestjs/common`, `@nestjs/common/internal` (`isFunction`, `tryLoadPackage`, `LegacyRouteConverter`): dùng thật.
- `fastify`, `@fastify/cors`, `@fastify/multipart`, `@fastify/static`, `@fastify/view`, `middie`, `path-to-regexp`: dùng thật; riêng plugin CORS/multipart được mock cục bộ trong file chuyên biệt để chạm nhánh lỗi/thiếu package.
- `fs/promises`: mock riêng hàm `unlink` trong test `disk.storage` để chạm nhánh lỗi xoá file.
- `stream`, `net`, `http-errors`: dùng thật hoặc stub tối thiểu.

### Bước 3-4 - CFG / C3 và test path

Quy ước: mỗi điều kiện con là một nút quyết định riêng, short-circuit được tôn trọng.
Các nhóm chính:

- **`FastifyAdapter` - HTTP verbs / `init` / `listen` / versioning**
  - Verb: nhánh có route options và không có; nhánh `VERSION_NEUTRAL`; nhánh method không hỗ trợ.
  - `init`: `isParserRegistered` T/F, `pathPrefix` rỗng/khác rỗng, hook onRequest/onResponse có/không.
  - `listen`: `port` là `0`, số, chuỗi; `isValidPort` T/F; lỗi listen được map qua `mapException`.
  - Versioning: `VersioningType.URI`/`HEADER`/`MEDIA_TYPE`/`CUSTOM`; version extractor lỗi; constraint rỗng/không rỗng.
- **`FastifyAdapter` - reply/response**
  - `status` phân biệt reply thật và native response (`'status' in response`).
  - `reply`: `StreamableFile`, stream thường, `Response`, typed array, view engine, redirect, lỗi `Error` với status 4xx/5xx/không xác định.
  - `getHeader`/`setHeader`/`appendHeader`: reply và raw response; `set-cookie` gộp mảng; headers đã gửi.
  - `end`: reply/native, `HEAD`, stream không có `destroy`.
- **`FastifyAdapter` - CORS**
  - `hook` khác `onRequest`: đăng ký plugin trực tiếp.
  - Proxy `addHook`: tên `onRequest` và chưa có hook / đã có hook / tên khác.
  - Proxy property: function (bind) và non-function (giữ nguyên) - test bằng plugin CORS giả đọc một property không phải function.
  - Callback plugin: `err` truthy -> reject; `null` -> resolve.
  - Options là function 0/1 tham số -> gọi với instance; >= 2 tham số hoặc object -> dùng trực tiếp.
- **`FastifyAdapter` - multipart**
  - `multipartMode` `off`/`auto`/`eager`; `isMultipartRequested` idempotent.
  - Plugin đã đăng ký (`hasRequestDecorator('isMultipart')`) -> bỏ qua.
  - Package thiếu (`tryLoadPackage` trả falsy) -> throw `MISSING_MULTIPART_PACKAGE_MESSAGE`.
  - `limits` có/không; options được copy.
- **`FastifyAdapter` - middleware**
  - `path.endsWith('$')` T/F; `LegacyRouteConverter.tryConvert` với `/*`, `/+`, path thường.
  - Fallback `normalizedPath === '/*path'` -> `'*path'` (phủ bằng path `/+`).
  - `_pathPrefix` + path `/` hoặc rỗng; `caseSensitive`; middleware trả Promise/thenable/non-thenable; throw đồng bộ; reject bất đồng bộ; next gọi nhiều lần; lỗi đăng ký path.
- **`FastifyAdapter` - body parser / route options**
  - Custom parser vs default; `rawBody`; mảng content type; RegExp `lastIndex`; catch-all `'*'`.
  - `injectRouteOptions`: path dạng tuple/không tuple; metadata config/constraints/schema; method hỗ trợ/không hỗ trợ.
  - `requireNonEmptyParams`: URL không có tham số, tham số rỗng, wildcard.
- **`getMediaTypeVersion`**: `key='v='`, tham số có/không có prefix, giá trị rỗng, nhiều tham số, chuỗi không phải media type.
- **`appendField`**: tên thường, `a[b]`, `a[]`, `a[0]`, tên dẫn đầu `[`, depth/index vượt giới hạn, prototype pollution.
- **`multipart.parser`**:
  - `resolveStorage`: storage tường minh / `dest` / mặc định memory.
  - `validateLimits`: undefined, rỗng, giá trị âm/không phải số.
  - `processMultipart`: plugin thiếu, không phải multipart, reset `req.file`/`req.files`, VALUE/ARRAY/OBJECT/NONE, file filter accept/reject/error, `maxCount`, field validation, limits function.
  - `storeFile`: stream đã destroyed, abort trước callback, callback sau abort, abort đến sau callback (`calledBack` guard), read-ahead thành công/thất bại, lỗi xoá file.
  - `readingAhead`: `nextPart` có/không có phần đọc trước; `readAhead` giữ nguyên promise đang chờ.
  - `drainRequest`: request đã end, đang chảy, bị destroy.
- **`memoryStorage` / `diskStorage`**: ghi file thành công, lỗi ghi, xoá file, `unlink` lỗi, `getFilename`/`getDestination` function và chuỗi.
- **Interceptor**: thiếu plugin, sai adapter, không có file, một file/nhiều file/field, stream, `NoFiles`, lỗi pipe.
- **`MultipartModule`**: `forRoot` đồng bộ, `forRootAsync` với `useFactory`/`useClass`/`useExisting`, global module.

Số path infeasible: **1** - nhánh `false` của `if (!partReadAhead)` tại
`multipart/multipart/multipart.parser.ts:257`. `readAhead()` chỉ được gọi từ handler
`'close'` của stream, và sự kiện `close` chỉ phát một lần cho mỗi stream, nên
`partReadAhead` luôn `undefined` ở lần gọi duy nhất đó.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/platform-fastify/constants.spec.ts`
- `ai-generated-tests/packages/platform-fastify/adapters/fastify-adapter.spec.ts`
- `ai-generated-tests/packages/platform-fastify/adapters/fastify-adapter.cors.spec.ts`
- `ai-generated-tests/packages/platform-fastify/adapters/fastify-adapter.multipart-missing.spec.ts`
- `ai-generated-tests/packages/platform-fastify/adapters/utils/get-media-type-version.util.spec.ts`
- `ai-generated-tests/packages/platform-fastify/decorators/route-config.decorator.spec.ts`
- `ai-generated-tests/packages/platform-fastify/decorators/route-constraints.decorator.spec.ts`
- `ai-generated-tests/packages/platform-fastify/decorators/route-schema.decorator.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/multipart.module.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/multipart/append-field.util.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/multipart/multipart.constants.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/multipart/multipart.error.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/multipart/multipart.parser.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/multipart/multipart.utils.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/multipart/multipart-interceptor.factory.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/storage/memory.storage.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/storage/disk.storage.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/interceptors/file.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/interceptors/files.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/interceptors/any-files.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/interceptors/file-fields.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/interceptors/no-files.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-fastify/multipart/interceptors/file-stream.interceptor.spec.ts`
- Helper dùng chung: `ai-generated-tests/packages/platform-fastify/multipart/upload-test.helper.ts`

- Sử dụng Parameterized Test (`it.each`) cho: HTTP verbs, status/header helpers, body parser content types, media type version, append-field, limits, interceptor variants.
- File `fastify-adapter.cors.spec.ts` mock `@fastify/cors` để chạm nhánh non-function property và callback lỗi.
- File `fastify-adapter.multipart-missing.spec.ts` tách riêng và mock `@fastify/multipart` để tránh cache `tryLoadPackage` của các test trước, chạm nhánh package thiếu.
- `disk.storage.spec.ts` mock `fs/promises.unlink` để chạm nhánh lỗi xoá.

### Bước 6 - Kết quả thực thi và coverage

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/platform-fastify --reporter=dot
```

Kết quả: **23 test files, 576 tests passed, 0 failed, 0 lỗi biên dịch/import**.

Coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/platform-fastify --coverage --reporter=dot
```

Kết quả (`@vitest/coverage-v8`):

- Statements: **100%** (1033/1033)
- Branches: **99.85%** (701/702)
- Functions: **100%** (253/253)
- Lines: **100%** (1008/1008)
- File còn thiếu nhánh: `multipart/multipart/multipart.parser.ts` (dòng 257, nhánh đã nêu ở Bước 3-4 là infeasible).

Giới hạn công cụ: `@vitest/coverage-v8` không báo C3 theo nghĩa atomic-condition trực tiếp.
Số liệu trên là branch/statement/function/line coverage; các cặp T/F của từng điều kiện con
được thiết kế và ghi chú trong tên test/nhóm test theo CFG ở trên. V8 cũng có thể gộp
một số điều kiện short-circuit thành một branch, nên branch coverage không đồng nhất
1-1 với số điều kiện atomic.

### Bước 7 - Trạng thái

- Module `packages/platform-fastify`: **hoàn tất**.
- Số hàm in-scope: **toàn bộ hàm public/private của module đã sinh test**, **0 bỏ qua**, **0 BLOCKED**.
- Coverage: statements/lines/functions 100%; branches 99.85% (1 nhánh infeasible đã ghi rõ).
- Không sửa production code, file build/dependency hay test có sẵn.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test đã có.

## Module 13 - Hoàn thiện độ phủ `packages/common`

- Thực hiện sau module `packages/platform-fastify`; không sinh lại các test đã có.
- Đối chiếu 103 file nguồn `packages/common/**/*.ts` (loại `test/`, `*.spec.ts`, `index.ts`, `*.interface.ts`) với 101 spec hiện có.
- 5 file nguồn chưa có spec tương ứng, phân loại:
  - `constants.ts` → **đã bổ sung spec**.
  - `services/log-levels.constant.ts` → **đã bổ sung spec**.
  - `internal.ts` → barrel re-export, out-of-scope (không có logic).
  - `serializer/class-serializer.interfaces.ts` → type-only, out-of-scope.
  - `serializer/standard-schema-serializer.interfaces.ts` → type-only, out-of-scope.

### File test bổ sung

- `ai-generated-tests/packages/common/constants.spec.ts`
- `ai-generated-tests/packages/common/services/log-levels.constant.spec.ts`

Cả hai dùng Parameterized Test (`it.each`), kiểm tra toàn bộ hằng số/hằng tuple; 0 decision node, 1 path độc lập.

### Kết quả thực thi

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common --reporter=dot
```

- **103 test files, 1751 tests passed, 0 failed**.

### Coverage

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/common --coverage --coverage.include="packages/common/**/*.ts" --coverage.reporter=text
```

| Metric | Kết quả |
| --- | --- |
| Statements | **100%** (1771/1771) |
| Branches | **99.76%** (1271/1274) |
| Functions | **100%** (409/409) |
| Lines | **100%** (1748/1748) |

### 2 nhánh infeasible (không thể phủ nếu không sửa production)

1. `packages/common/decorators/http/route-params.decorator.ts:121`
   - Nhánh phải của `(pipes ?? [])` trong nhánh `hasParamData === false`.
   - Mọi call site truyền `data` không phải string đều truyền `pipes` là array
     (`...pipes` rest hoặc array đã `filter(Boolean)`), còn call site bỏ trống
     `pipes` (nhánh options-first) cũng bỏ trống `data` nên `hasParamData === true`.
   - Do đó không thể có đồng thời `data` non-string và `pipes === undefined` qua public API.
2. `packages/common/utils/parameter-decorator-options.util.ts:5`
   - Nhánh `isFunction(value) && value.prototype && isFunction(value.prototype.transform)`
     của `isPipeLike`.
   - `isPipeLike` chỉ được gọi sau điều kiện `typeof value === 'object'` trong
     `isParameterDecoratorOptions`; hàm có `typeof value === 'function'` nên không bao giờ lọt vào.
   - Đây là nhánh phòng thủ không thể chạm tới (dead defensive branch).

- Không sửa production code, không sửa test có sẵn.
- Trạng thái: `packages/common` **hoàn tất** phần test AI sinh; đang dừng, chờ chỉ định module tiếp theo.

## Module 13 - `packages/websockets`

### Bước 1 - Khảo sát project

- Test runner của repo: `vitest` (`npm test` -> `vitest run`).
- Cấu hình gốc: `vitest.config.mts`; alias `@nestjs/*`, setup `reflect-metadata`.
- Test hiện có của module: `packages/websockets/test/**/*.spec.ts`.
- Baseline chạy trước khi sinh test:

```bash
npx vitest run packages/websockets/test --reporter=dot
```

Kết quả baseline: **21 test files, 171 tests passed, 0 failed**.

- Coverage baseline của test có sẵn (chỉ để tham khảo):
  statements 86.38%, branches 83.94%, functions 81.01%, lines 86.44%.
- Cấu hình riêng cho test AI sinh: `ai-generated-tests/vitest.config.mts`.
  Cấu hình chỉ include `ai-generated-tests/**/*.spec.ts`; coverage include
  `packages/websockets/**/*.{ts,js}` và loại `test/**`, `interfaces/**`, `index.ts`,
  `*.spec.ts`, `*.test.ts`.

### Bước 2 - Phân loại hàm

#### In-scope (đã sinh test)

| File production | Hàm/phương thức | Trạng thái |
| --- | --- | --- |
| `constants.ts` | toàn bộ metadata key/event name/`DEFAULT_MAX_CONCURRENT_MESSAGES` | Tested |
| `adapters/ws-adapter.ts` | `AbstractWsAdapter`: constructor, `forceCloseConnections` getter/setter, `bindClientConnect`, `bindClientDisconnect`, `close`, `dispose` | Tested |
| `context/exception-filters-context.ts` | `constructor`, `create`, `getGlobalMetadata` | Tested |
| `context/ws-context-creator.ts` | `create`, `reflectCallbackParamtypes`, `reflectCallbackPattern`, `createGuardsFn`, `getMetadata`, `exchangeKeysForValues`, `createPipesFn`, `getParamValue` | Tested |
| `context/ws-proxy.ts` | `create`, `handleError` | Tested |
| `context/ws-metadata-constants.ts` | `DEFAULT_CALLBACK_METADATA` | Covered qua `ws-context-creator` |
| `decorators/*.ts` | `Ack`, `ConnectedSocket`, `WebSocketServer`, `MessageBody` (mọi overload), `WebSocketGateway` (mọi overload), `SubscribeMessage` | Tested |
| `enums/ws-paramtype.enum.ts` | `WsParamtype` | Tested |
| `errors/invalid-socket-port.exception.ts` | `InvalidSocketPortException` | Tested |
| `errors/ws-exception.ts` | `constructor`, `initMessage`, `getError` | Tested |
| `exceptions/base-ws-exception-filter.ts` | `constructor`, `catch`, `handleError`, `handleUnknownError`, `isExceptionObject`, `emitMessage`, `emitErrorPayload`, `isNativeWebSocket` | Tested |
| `exceptions/ws-exceptions-handler.ts` | `handle`, `setCustomFilters`, `invokeCustomFilters` | Tested |
| `factories/server-and-event-streams-factory.ts` | `create` | Tested |
| `factories/ws-params-factory.ts` | `exchangeKeyForValue`, `getPayloadProperty` | Tested |
| `gateway-metadata-explorer.ts` | `constructor`, `explore`, `exploreMethodMetadata`, `hasAckDecorator`, `scanForServerHooks` | Tested |
| `socket-module.ts` | `register`, `connectAllGateways`, `connectGatewayToServer`, `close`, `initializeAdapter`, `getContextCreator` | Tested |
| `socket-server-provider.ts` | `scanForSocketServer`, `createSocketServer`, `decorateWithNamespace`, `getServerOfNamespace`, `validateNamespace` | Tested |
| `sockets-container.ts` | `getAll`, `getOneByConfig`, `addOne`, `clear`, `generateHashByOptions` | Tested |
| `utils/compare-element.util.ts` | `compareElementAt` | Tested |
| `utils/get-param-args-metadata.util.ts` | `getParamArgsMetadata` | Tested |
| `utils/merge-map-bounded.util.ts` | `mergeMapBounded`, `drain` | Tested |
| `utils/param.utils.ts` | `createWsParamDecorator`, `createPipesWsParamDecorator` | Tested |
| `web-sockets-controller.ts` | `connectGatewayToServer` (2 overload), `subscribeToServerEvents`, `subscribeEvents`, `getConnectionHandler`, `subscribeInitEvent`, `subscribeConnectionEvent`, `subscribeDisconnectEvent`, `subscribeMessages`, `pickResult`, `inspectEntrypointDefinitions`, `createRequestScopedHandler`, `createRequestScopedEventHandler`, `createStaticEventHandler`, `logResolutionError`, `areGlobalScopedEnhancersDurable`, `handleLifecycleHookError`, `getGlobalScopedEnhancers`, `getContextId`, `cleanupRequestScopedContext`, `assignServerToProperties`, `printSubscriptionLogs` | Tested |

#### Out-of-scope

- `index.ts`, `adapters/index.ts`, `decorators/index.ts`, `errors/index.ts`, `exceptions/index.ts`, `utils/index.ts`,
  `interfaces/**`, `interfaces/hooks/**`: re-export/type-only, không có logic thực thi.
- `internal.ts`: chỉ re-export.
- `Readme.md`, `package.json`, `tsconfig*.json`: không có logic.
- `packages/websockets/test/**`: test có sẵn, không sửa, chỉ dùng baseline/reference.

#### Indirect dependency

- `@nestjs/common`, `@nestjs/common/internal`, `@nestjs/core`, `@nestjs/core/internal`: dùng thật
  (`ExecutionContextHost`, `ContextIdFactory`, `MetadataScanner`, `ApplicationConfig`, các context creator/consumer).
- `rxjs` (`Subject`, `ReplaySubject`, `of`, `throwError`, `from`, operators): dùng thật.
- `object-hash`, `iterare`, `reflect-metadata`: dùng thật.
- `socket.io`/`@nestjs/platform-socket.io`: chỉ dùng thật trong nhánh tạo adapter mặc định của `SocketModule`;
  adapter WebSocket được stub cho phần còn lại.

### Bước 3-4 - CFG / C3 và test path

Quy ước: mỗi điều kiện con là một nút quyết định riêng, short-circuit được tôn trọng.
Các nhóm chính:

- **`AbstractWsAdapter`**: `appOrHttpServer instanceof NestApplication` T/F; `client.once` là function T/F;
  `server && isFunction(server.close)` T/F; getter/setter `forceCloseConnections`.
- **Decorators**: `WebSocketGateway` với port integer / options object / cả hai / không tham số / số không nguyên;
  `MessageBody` với không data, property key, pipes, options object (có/không pipes), data + options,
  pipe-first, falsy pipes; `getParamArgsMetadata` lọc entry kế thừa cùng index.
- **`WsException`**: string, object có message string, object message không string, number;
  class name không có từ nào -> `'Error'`; nhánh `this.constructor` falsy (infeasible).
- **`BaseWsExceptionFilter`**: options mặc định/tuỳ chỉnh; `includeCause` T/F;
  cause factory mặc định/tuỳ chỉnh; `WsException` string/object/Error; unknown error;
  native WebSocket (`readyState` number + `send`) vs Socket.IO (`emit`); client không có emit/send;
  gửi payload lỗi có cause -> retry không cause; không cause -> rethrow; `IntrinsicException` không log.
- **`WsExceptionsHandler`**: không client, custom filter khớp/không khớp, filters rỗng,
  `setCustomFilters` array/không array.
- **`WsProxy`**: kết quả non-observable, observable thành công/lỗi, throw đồng bộ, pattern mặc định `'unknown'`.
- **`WsParamsFactory`**: args falsy; SOCKET/PAYLOAD/ACK/unknown; payload key trên object thường/array/Buffer/primitive/null;
  own property vs inherited property; ACK tìm function.
- **`GatewayMetadataExplorer`**: method có/không `@SubscribeMessage`; `@Ack` có/không;
  scan server hook bỏ qua function property và property không metadata.
- **`SocketsContainer`**: hash ổn định theo key order, phân biệt options, clear.
- **`SocketServerProvider`**: server đã có/chưa có; namespace có/không; namespace string/RegExp/rỗng;
  tạo root server rồi tạo namespace server.
- **`SocketModule`**: module rỗng/nhiều module; wrapper null/`isNotMetatype`/hợp lệ; gateway metadata có/không;
  adapter có sẵn/chưa có; memoize `adapterInitPromise`; `close` không config/không adapter/có nhiều server;
  server falsy bị lọc; `dispose`.
- **`WsContextCreator`**: `create` với guards/pipes/interceptors; guard cho phép/từ chối;
  params metadata có/không (nhánh không metadata dùng default); pipes rỗng/không rỗng; custom param key;
  cache metadata; `getParamValue` có/không pipes.
- **`WebSocketsController`**:
  - `connectGatewayToServer`: port không integer -> `InvalidSocketPortException`; wrapper/instance overload;
    metadata port/options rỗng hoặc có.
  - `subscribeToServerEvents`: static/transient, có/không global enhancers, `preview` true/false.
  - `subscribeEvents`: init/connection/disconnect, bind connect, log.
  - `getConnectionHandler`: disconnect trong lúc connecting được giữ lại; disconnect sau connecting;
    không có `bindClientDisconnect`; `subscribeMessages` throw vẫn flush disconnect trong `finally`.
  - `subscribeConnectionEvent` / `subscribeDisconnectEvent`: handler function/gateway, dedupe theo client,
    data dạng `{ client, reason }` và backward-compatible raw client/null, không handler.
  - `pickResult`: Observable, Promise, giá trị thường.
  - `createRequestScopedHandler`: singleton + global enhancers, transient loadPerContext, durability,
    lỗi handler -> filter lazy, pattern `'unknown'`.
  - `createRequestScopedEventHandler`: static/transient, assign server, pending disconnect count,
    cleanup khi remaining > 0 và = 0, không xoá context mới hơn, lỗi resolve không hook/enhancer,
    filter nhận client + reason + tên hook.
  - `createStaticEventHandler`: không hook, hook sync, throw sync, reject async, disconnect reason.
  - `getContextId`: tạo mới (durable/non-durable), tái sử dụng context id.
  - `assignServerToProperties`, `printSubscriptionLogs` (không constructor name/có nhiều handler).

Số nhánh infeasible/không ghi nhận: **5** (chi tiết ở Bước 6).

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/websockets/constants.spec.ts`
- `ai-generated-tests/packages/websockets/gateway-metadata-explorer.spec.ts`
- `ai-generated-tests/packages/websockets/socket-module.spec.ts`
- `ai-generated-tests/packages/websockets/socket-server-provider.spec.ts`
- `ai-generated-tests/packages/websockets/sockets-container.spec.ts`
- `ai-generated-tests/packages/websockets/web-sockets-controller.spec.ts`
- `ai-generated-tests/packages/websockets/adapters/ws-adapter.spec.ts`
- `ai-generated-tests/packages/websockets/context/exception-filters-context.spec.ts`
- `ai-generated-tests/packages/websockets/context/ws-context-creator.spec.ts`
- `ai-generated-tests/packages/websockets/context/ws-proxy.spec.ts`
- `ai-generated-tests/packages/websockets/decorators/decorators.spec.ts`
- `ai-generated-tests/packages/websockets/errors/ws-exception.spec.ts`
- `ai-generated-tests/packages/websockets/exceptions/base-ws-exception-filter.spec.ts`
- `ai-generated-tests/packages/websockets/exceptions/ws-exceptions-handler.spec.ts`
- `ai-generated-tests/packages/websockets/factories/server-and-event-streams-factory.spec.ts`
- `ai-generated-tests/packages/websockets/factories/ws-params-factory.spec.ts`
- `ai-generated-tests/packages/websockets/utils/compare-element.util.spec.ts`
- `ai-generated-tests/packages/websockets/utils/get-param-args-metadata.util.spec.ts`
- `ai-generated-tests/packages/websockets/utils/merge-map-bounded.util.spec.ts`

- Sử dụng Parameterized Test (`it.each`) cho: metadata constants, compare element, payload extraction,
  namespace normalization, connection/disconnect dedupe, exception payloads.
- Các phần phức tạp dùng mock/stub có kiểm soát: `ApplicationConfig`, `Injector`, `NestContainer`,
  `SocketServerProvider`, `WsContextCreator`, adapter, `GraphInspector`, `ExceptionFiltersContext`.
- `SocketModule` được test nhánh tạo adapter mặc định bằng `@nestjs/platform-socket.io` thật (không mở cổng mạng).

### Bước 6 - Kết quả thực thi và coverage

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/websockets --reporter=dot
```

Kết quả: **19 test files, 230 tests passed, 0 failed, 0 lỗi biên dịch/import**.

Coverage:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/websockets --coverage --reporter=dot
```

Kết quả (`@vitest/coverage-v8`):

- Statements: **99.82%** (572/573)
- Branches: **98.32%** (294/299)
- Functions: **100%** (158/158)
- Lines: **99.82%** (567/568)

Các nhánh còn thiếu/không ghi nhận:

- `socket-server-provider.ts:83` - `options.namespace || ''`: nhánh fallback `''` không thể xảy ra vì
  `decorateWithNamespace` chỉ được gọi khi namespace truthy.
- `web-sockets-controller.ts:365-366` - `result instanceof Promise`: `await` đã unwrap thenable nên
  một Promise thật không thể còn lại sau `await`.
- `web-sockets-controller.ts:505` - nhánh bỏ qua `assignServerToProperties` của `if (!isStatic)`:
  đã có cả test static và transient nhưng V8 không ghi nhận nhánh static (giới hạn mapping của coverage engine).
- `web-sockets-controller.ts:672` - fallback `?? 0` của `pendingDisconnects.get(contextId)`:
  đã có test disconnect đầu tiên trên client mới nhưng V8 không ghi nhận vế fallback.
- `errors/ws-exception.ts:17` - `else if (this.constructor)`: `constructor` luôn tồn tại trên instance,
  nhánh false không thể xảy ra nếu không sửa prototype.

Giới hạn công cụ: `@vitest/coverage-v8` không báo C3 theo nghĩa atomic-condition trực tiếp.
Số liệu trên là branch/statement/function/line coverage; các cặp T/F của từng điều kiện con
được thiết kế và ghi chú trong tên test/nhóm test theo CFG ở trên. V8 có thể gộp điều kiện
short-circuit thành một branch hoặc không ghi nhận nhánh không có statement, nên branch coverage
không đồng nhất 1-1 với số điều kiện atomic.

Lưu ý khi chạy toàn bộ suite AI sinh:

```bash
npx vitest run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **147 test files, 2610 tests passed, 0 failed**.

### Bước 7 - Trạng thái

- Module `packages/websockets`: **hoàn tất**.
- Số hàm in-scope: **toàn bộ hàm public/private của module đã sinh test**, **0 bỏ qua**, **0 BLOCKED**.
- Coverage: statements/lines 99.82%, functions 100%, branches 98.32% (5 nhánh infeasible/không ghi nhận đã nêu).
- Không sửa production code, file build/dependency hay test có sẵn.
- Đang dừng, chờ chỉ định module tiếp theo. Khi tiếp tục, đọc file này để tránh sinh lại test đã có.

## Module 9 - packages/platform-node

### Bước 1 - Phạm vi
- Module: `packages/platform-node` (`@nestjs/platform-node`).
- Test AI: `ai-generated-tests/packages/platform-node/**`.
- Không sửa production/test gốc; baseline gốc vẫn `16 files, 818 tests passed`.

### Bước 2 - File test đã sinh (17 file, 430 tests)
- `ai-generated-tests/packages/platform-node/adapters/utils/get-media-type-version.util.spec.ts`
- `ai-generated-tests/packages/platform-node/adapters/utils/hostname.util.spec.ts`
- `ai-generated-tests/packages/platform-node/adapters/configured-request.spec.ts`
- `ai-generated-tests/packages/platform-node/adapters/node-request.spec.ts`
- `ai-generated-tests/packages/platform-node/adapters/node-adapter.spec.ts`
- `ai-generated-tests/packages/platform-node/body-parser/body-parser.spec.ts`
- `ai-generated-tests/packages/platform-node/multer/multer.module.spec.ts`
- `ai-generated-tests/packages/platform-node/multer/multer/multer.utils.spec.ts`
- `ai-generated-tests/packages/platform-node/multer/interceptors/any-files.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-node/multer/interceptors/file-fields.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-node/multer/interceptors/file.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-node/multer/interceptors/files.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-node/multer/interceptors/no-files.interceptor.spec.ts`
- `ai-generated-tests/packages/platform-node/router/utils.spec.ts`
- `ai-generated-tests/packages/platform-node/router/route-table.spec.ts`
- `ai-generated-tests/packages/platform-node/router/node-router.spec.ts`
- `ai-generated-tests/packages/platform-node/views/view-renderer.spec.ts`

### Bước 3 - Kỹ thuật
- CFG/C3 ghi chú đầu mỗi nhóm test; dùng `it.each` cho biến thể interceptor, versioning, Accept/Vary, limit, charset, status không body.
- Mock `NodeResponse`/`NodeRequest` bằng `Object.create(prototype)` và stub `writeHead/end/setHeader/getHeader`; dùng `Writable` thật cho operator `finished(res)` của `removeFilesOnPipeRejection`.
- `node-router.spec.ts` dùng request/response thật ở mức prototype để chạy `handle()`/`dispatch()`.

### Bước 4 - Coverage
- Trong lúc đo coverage riêng cho module, cấu hình được tạm điều chỉnh để include `packages/platform-node/**` và exclude `interfaces`, `multer/interfaces`, `test`; sau đó đã khôi phục cấu hình ban đầu theo yêu cầu. Thay đổi cấu hình không nằm trong commit này.

### Bước 5 - Kết quả
```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/platform-node --coverage --reporter=dot
```
- **17 test files, 430 tests passed, 0 failed.**
- Toàn bộ AI suite: **143 files, 2769 tests passed.**
- Baseline gốc: **16 files, 818 tests passed.**

Coverage module (`@vitest/coverage-v8`):
- Statements: **77.6%**
- Branches: **75.62%**
- Functions: **77.21%**
- Lines: **77.46%**
- Đã đạt 100%: `configured-request.ts`, `get-media-type-version.util.ts`, `hostname.util.ts`, toàn bộ `multer` + 5 interceptor + `files.constants.ts`, `multer.constants.ts`.
- Chưa phủ hết: `node-adapter.ts` (36.33% statements: `listen`, `inject`, `initHttpServer`, `finalHandler`, streaming/security hook), `node-request.ts` (75.74%: nhánh `sendFile` thành công), `body-parser.ts` (81.85%: nén gzip/br thành công), `route-table.ts` (84.89%), `node-router.ts` (86.52%).

### Bước 6 - Trạng thái
- Module `packages/platform-node`: đã sinh test cho toàn bộ họ hàm/util/module/interceptor in-scope; các nhánh còn thiếu thuộc tích hợp server/inject/stream và nén, chưa đạt 100%.
- Không sửa production code; test được commit chung với module `packages/testing`.
- Đang dừng, chờ module tiếp theo.

## Module 10 - `packages/testing`

### Bước 1 - Khảo sát project

- Module: `packages/testing` (`@nestjs/testing` 12.4.2), TypeScript ESM.
- Test runner: Vitest 5.1.0 (root `vitest.config.mts`, globals, alias `@nestjs/*`, setup `reflect-metadata`).
- Test có sẵn của module: `packages/testing/test/**/*.spec.ts` (7 file, 110 test).
- Baseline chạy trước khi sinh test:

```bash
node node_modules/vitest/vitest.mjs run packages/testing --reporter=dot
```

Kết quả baseline: **7 test files, 110 tests passed, 0 failed**.

- Trong lúc đo coverage riêng cho module, cấu hình được tạm điều chỉnh để include `packages/testing/**/*.{ts,js}` và exclude test/interfaces; sau đó đã khôi phục cấu hình ban đầu theo yêu cầu. Thay đổi cấu hình không nằm trong commit này.
- Không chạy test suite có sẵn; chỉ chạy test AI sinh theo quy định lưu trữ.

### Bước 2 - Phân loại hàm

#### In-scope (7 file runtime, 74 hàm)

| File production | Thành phần runtime | Trạng thái |
| --- | --- | --- |
| `test.ts` | `Test.createTestingModule` | Tested |
| `testing-module.ts` | `TestingModule.constructor`, `preloadLazyPackages`, `isHttpServer`, `createNestApplication` (2 overload), `createNestMicroservice`, `createHttpAdapter`, `applyLogger`, `createAdapterProxy` | Tested |
| `testing-module.builder.ts` | `TestingModuleBuilder.constructor`, `setLogger`, `overridePipe`, `useMocker`, `overrideFilter`, `overrideGuard`, `overrideInterceptor`, `overrideProvider`, `overrideModule`, `compile`, `override`, `createOverrideByBuilder`, `applyOverloadsMap`, `getModuleOverloads`, `getRootModule`, `createInstancesOfDependencies`, `createModule`, `applyLogger` | Tested |
| `testing-injector.ts` | `TestingInjector.setMocker`, `setContainer`, `lookupSkippedProviderDependencies`, `resolveComponentWrapper`, `resolveComponentHost`, `mockWrapper` | Tested |
| `testing-instance-loader.ts` | `TestingInstanceLoader.createInstancesOfDependencies` | Tested |
| `services/capturing-logger.service.ts` | `CapturingLogger` constructor, `entries`, 6 level methods, `filter`, `find`, `assertLogged`, `assertNotLogged`, `clear`, `capture`; helpers `toPredicate`, `describeMatcher`, `formatEntries` | Tested |
| `services/testing-logger.service.ts` | `TestingLogger.constructor`, `log`, `warn`, `debug`, `verbose`, `error` | Tested |

#### Out-of-scope

- `index.ts`: chỉ re-export.
- `interfaces/*.ts` + `interfaces/index.ts`: type/interface-only, bị xóa khi transpile.
- `test/**`: test gốc của người dùng, chỉ đọc tham khảo, không sửa/copy.

#### Indirect dependency

- `NestContainer`, `ApplicationConfig`, `GraphInspector`, `NoopGraphInspector`,
  `InstanceWrapper`, `Injector`, `InstanceLoader`, `DependenciesScanner`, `UuidFactory`:
  dùng thật hoặc spy prototype để cô lập.
- `ExpressAdapter` / `NestApplication` / `NestMicroservice`: dùng thật; riêng
  `NestMicroservice` được thay bằng class giả qua `tryLoadPackage` để tránh khởi tạo transport.
- `Logger`, `ConsoleLogger`, `process.stdout/stderr`: dùng thật, spy khi cần kiểm tra hành vi in.

### Bước 3-4 - CFG / C3 và test path

- **`Test.createTestingModule`**: 0 decision node, 1 path; tham số hoá metadata/options.
- **`TestingModule`**:
  - `preloadLazyPackages`: 2 lời gọi nối tiếp, 0 decision node.
  - `isHttpServer`: `serverOrOptions && serverOrOptions.patch` (short-circuit) - phủ
    undefined, `{}`, object không `patch`, adapter có `patch`.
  - `createNestApplication`: ternary `isHttpServer(...)` T/F; `applyLogger` với
    `!options || isUndefined(options.logger)` phủ cả 4 tổ hợp; nhánh có/không logger.
  - `createNestMicroservice`: 0 decision node, gọi `loadPackageCached` + `applyLogger`.
  - `createHttpAdapter`: 0 decision node; phủ có/không `httpServer`.
  - `createAdapterProxy` (`get` trap):
    - `!(prop in receiver) && prop in adapter` (short-circuit): property của adapter,
      property của application, property không tồn tại.
    - `!isFunction(value)`: non-function trả trực tiếp; function được gọi.
    - `result === adapter`: chainable trả proxy; non-chainable trả kết quả.
- **`TestingModuleBuilder`**:
  - Mỗi `overridePipe/Filter/Guard/Interceptor/Provider`: `isProvider` T/F, cả 3 nhánh
    `useValue`/`useFactory`/`useClass`.
  - `overrideModule.useModule`: lưu map và trả builder.
  - `compile`: `options?.snapshot` T/F (NoopGraphInspector vs GraphInspector,
    UuidFactory Random/Deterministic), `options?.preview` T/F, `options?.preview ?? false`,
    `options?.snapshot ?? false`, `this.mocker` có/không, `testingLogger || new TestingLogger`.
  - `applyOverloadsMap`: map rỗng và map có provider + injectable (thứ tự provider trước).
  - `getModuleOverloads`: rỗng và có override.
  - `getRootModule`: lấy module đầu tiên.
- **`TestingInjector`**:
  - `lookupSkippedProviderDependencies`: `this.mocker` T/F; parent resolve/reject.
  - `resolveComponentWrapper`: super success; super reject với `mocker` undefined;
    `mocker` trả truthy/falsy; cache theo token; token khác nhau; thiếu internal core module.
  - `resolveComponentHost`: super success/reject; `mocker` T/F; dùng `instanceWrapper.name`.
  - `mockWrapper`: `!this.mocker`, cache hit/miss, `!mockedInstance`,
    `!internalCoreModule`; đăng ký `addCustomProvider` + `addExportedProviderOrModule`.
- **`TestingInstanceLoader.createInstancesOfDependencies`**:
  - `modules` mặc định (gọi `container.getModules`) / truyền tường minh.
  - `mocker &&` T/F; luôn `injector.setContainer`; chờ parent loader.
- **`CapturingLogger`**:
  - `isLevelEnabled(level)` T/F; nhánh error/fatal vs level thường; lazy message;
    `extractJsonError` (Error là message / sau message / không có);
    context/params/error/stack có/không; `shouldPrint` T/F; `isError` T/F.
  - `filter`: matcher function; từng tiêu chí level/context/message/params
    undefined/defined, string/regex, entry không có context/params, message non-string,
    deep-equal params.
  - `assertLogged`/`assertNotLogged`: tìm thấy/không; entries rỗng; >50 entries
    (bỏ 10 dòng đầu); format string/non-string/context/params.
  - `clear`, `entries` snapshot, `Logger.overrideLogger` cho instance/static.
- **`TestingLogger`**: 4 method im lặng; `error` chuyển tiếp message + optional params.

Số path infeasible: **0**. Toàn bộ nhánh khả thi của module đã được kích hoạt.

### Bước 5 - File test đã tạo

- `ai-generated-tests/packages/testing/test.spec.ts`
- `ai-generated-tests/packages/testing/testing-module.spec.ts`
- `ai-generated-tests/packages/testing/testing-module.builder.spec.ts`
- `ai-generated-tests/packages/testing/testing-injector.spec.ts`
- `ai-generated-tests/packages/testing/testing-instance-loader.spec.ts`
- `ai-generated-tests/packages/testing/services/capturing-logger.service.spec.ts`
- `ai-generated-tests/packages/testing/services/testing-logger.service.spec.ts`

- Sử dụng Parameterized Test (`describe.each`, `it.each`) cho override methods, level
  methods, logger options, `isHttpServer`, `applyLogger`, stack/error variants.

### Bước 6 - Kết quả thực thi và coverage

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/testing --reporter=dot
```

Kết quả: **7 test files, 127 tests passed, 0 failed, 0 lỗi biên dịch/import**.

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts ai-generated-tests/packages/testing --coverage --reporter=dot
```

Kết quả coverage (`@vitest/coverage-v8`):

- Statements: **100%** (190/190)
- Branches: **100%** (109/109)
- Functions: **100%** (74/74)
- Lines: **100%** (186/186)
- **7/7 file fully covered**, không có branch infeasible.

Chạy lại toàn bộ AI suite:

```bash
node node_modules/vitest/vitest.mjs run --config ai-generated-tests/vitest.config.mts --reporter=dot
```

Kết quả: **150 test files, 2896 tests passed, 0 failed**.

Giới hạn công cụ: `@vitest/coverage-v8` báo branch coverage, không báo C3 theo nghĩa
atomic-condition. C3 được thiết kế thủ công bằng CFG (tách từng điều kiện con,
tôn trọng short-circuit) và input cho cả T/F; toàn bộ điều kiện khả thi đã được phủ.
Các nhánh private được kiểm thử trực tiếp bằng white-box (gọi method private qua
truy cập bracket) và spy prototype của lớp cha.

### Bước 7 - Trạng thái

- Module `packages/testing`: **hoàn tất**.
- Số hàm in-scope: **74/74 đã sinh test**, **0 bỏ qua**, **0 BLOCKED**.
- Không sửa production code, file build/dependency hay test gốc; test được commit chung với module `platform-node`.
- Đang dừng, chờ chỉ định module tiếp theo.
