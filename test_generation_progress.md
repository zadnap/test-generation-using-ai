# Test Generation Progress

## Module hiện tại

- Module: `packages/common/module-utils` (hoàn tất)
- Module trước: `packages/common/file-stream`, `packages/common/serializer`, `packages/common/enums`, `packages/common/exceptions`, `packages/common/decorators`, `packages/common/interfaces`, `packages/common/services`, `packages/common/utils`, `packages/common/pipes` (hoàn tất)
- Repository: `nestjs/nest` (TypeScript, ESM)
- Test framework: Vitest `5.1.0`
- Coverage engine: `@vitest/coverage-v8`
- Ngôn ngữ test: TypeScript (`*.spec.ts`)
- Thư mục test AI sinh: `ai-generated-tests/packages/common/module-utils/`
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
