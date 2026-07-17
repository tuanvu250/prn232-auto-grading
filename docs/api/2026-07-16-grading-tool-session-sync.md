# Hướng dẫn Grading Tool sync kết quả theo Grading Session

> Cập nhật: 2026-07-16  
> Áp dụng cho schema `grading_sessions` / `session_submissions`.  
> Backend cần sửa: `../grading-auto-server`.  
> Frontend cần sửa: `../grading-auto-client`.  
> Tài liệu này thay thế flow cũ dùng `class_labs`, `class_lab_submissions` và
> RPC `create_class_lab_submission`.

## 0. Vị trí code thực tế đã kiểm tra

Luồng sync hiện tại nằm trong repo cùng cấp với frontend/backend Supabase:

```text
E:\TVu\git-repo\
├── prn232-auto-grading
├── grading-auto-server
└── grading-auto-client
```

### Backend `grading-auto-server`

Các file backend phải sửa:

| File | Thay đổi |
|---|---|
| `GradingSystem.Application/DTOs/LabAssignmentDto.cs` | Đổi response từ `ClassLabId` sang `GradingSessionId`; có thể bổ sung `GradingSessionId` optional vào request để hỗ trợ chọn session trực tiếp |
| `GradingSystem.Application/Interfaces/ISupabaseSyncService.cs` | Cập nhật chữ ký nếu thêm `gradingSessionId` |
| `GradingSystem.Application/Services/SupabaseSyncService.cs` | Thay toàn bộ bước resolve `class_labs` và RPC cũ bằng resolve `grading_sessions` + RPC mới |
| `GradingSystem.Api/Controllers/LabAssignmentsController.cs` | Route có thể giữ nguyên; controller chỉ cần dùng DTO/service contract mới |

Bốn API public hiện có và có thể giữ nguyên route:

```text
GET  /api/lab-assignments/supabase-dropdown-options
POST /api/lab-assignments/sync-supabase-grade
POST /api/lab-assignments/sync-supabase-grades
POST /api/lab-assignments/{id}/sync-supabase
```

Phần cần thay nằm chủ yếu trong `SupabaseSyncService`; không cần tạo thêm một
service sync thứ hai.

### Frontend `grading-auto-client`

UI sync Supabase không nằm trong `grading-auto-server`. Các file frontend thực
tế đã kiểm tra:

| File | Thay đổi |
| --- | --- |
| `src/types/lab.ts` | Thêm `gradingSessionId`; đổi `classLabId` thành `gradingSessionId`; bỏ `itemType` và `fulfillsRequestId` khỏi type kết quả |
| `src/lib/api.ts` | Giữ nguyên các route sync; truyền `gradingSessionId` trong request và nhận response type mới |
| `src/app/(app)/lab/assignments/[id]/components/ResultsTab.tsx` | Bổ sung state và dropdown chọn grading session; gửi session đã chọn khi gọi `syncLabSupabaseGrades(...)` |

Frontend hiện đang hiển thị modal theo thứ tự `Term -> Class -> Lab` trong
`ResultsTab.tsx`. Flow khuyến nghị sau migration là:

```text
Term -> Class -> Lab -> Grading session -> Start sync
```

Không sửa UI ở repo `prn232-auto-grading` cho thao tác sync của grading tool.

## 1. Contract mới và khả năng tương thích API cũ

API phía grading tool **có thể tiếp tục nhận** `termId + className + labCode`.
Đây là đúng tên field đang tồn tại trong DTO, không bắt buộc sửa đồng loạt các
caller đang gửi payload hiện tại.

Tuy nhiên, trước khi ghi Supabase, service sync phải resolve ba giá trị đó thành
đúng `grading_session_id`. Contract nội bộ tại bước ghi dữ liệu là:

```text
grading_session_id + student_code + source_url + score + details
```

Không truyền `termId + className + labCode` trực tiếp vào RPC. Một lớp và một
lab có thể có nhiều session ở các đợt khác nhau; RPC chỉ nhận UUID của session
cụ thể.

RPC ghi kết quả hiện tại:

```http
POST /rest/v1/rpc/create_session_submission
```

```json
{
  "p_class_student_id": "uuid",
  "p_grading_session_id": "uuid",
  "p_source_url": "https://drive.google.com/...",
  "p_score": 8.5,
  "p_details": {
    "passed": 17,
    "total": 20,
    "tests": []
  }
}
```

RPC tự động:

- kiểm tra sinh viên thuộc đúng lớp của session;
- tăng `attempt_no` nguyên tử;
- tính trạng thái `passed` khi điểm từ `5.0`, ngược lại là `failed`;
- ghi `item_type = original`;
- từ chối ghi khi session đã đóng hoặc đã qua deadline.

Tool không được insert trực tiếp vào `session_submissions`.

## 2. Cần sửa gì trong `grading-auto-server`

### 2.1 Payload public hiện tại có thể giữ nguyên

Ví dụ request mà grading tool đang nhận:

```json
{
  "termId": "0d8d7a56-0000-0000-0000-000000000000",
  "className": "SE1812",
  "labCode": "LAB1",
  "studentCode": "SE180234",
  "sourceUrl": "https://drive.google.com/file/d/...",
  "score": 8.5,
  "details": {
    "tests": []
  }
}
```

`termId` hiện là UUID trả về từ
`GET /api/lab-assignments/supabase-dropdown-options`, không phải chuỗi `SU26`.
Không cần bắt frontend/caller đổi payload này ngay. Thay đổi nằm trong service
sync Supabase.

### 2.2 Những method cũ phải bỏ hoặc thay

Trong `SupabaseSyncService.cs`, bỏ luồng sau:

- `GetRequiredClassLabAsync(...)`;
- `CreateClassLabSubmissionAsync(...)`;
- `GetApprovedResubmissionRequestIdAsync(...)`;
- `CompleteResubmissionRequestAsync(...)`;
- `DetermineItemType(...)` và các xử lý `FulfillsRequestId`;
- query `rest/v1/class_labs` trong `GetLabOptionsAsync(...)`.

Thay bằng:

- `GetRequiredOpenGradingSessionAsync(...)`;
- `CreateSessionSubmissionAsync(...)`;
- query `rest/v1/grading_sessions` trong dropdown/options;
- resolve `class_student_id` bằng `class_id` lấy trực tiếp từ session.

Flow đang tồn tại và cần xóa:

```text
termId + className + labCode
  -> class_lab_id
  -> create_class_lab_submission
```

Không còn sử dụng:

- bảng `class_labs`;
- bảng `class_lab_submissions`;
- RPC `create_class_lab_submission`;
- các tham số `p_class_lab_id`, `p_item_type`, `p_fulfills_request_id`.

### 2.3 Flow mới trong `SyncResolvedGradeAsync`

```text
termId + className + labCode
  -> term_id
  -> class_id
  -> lab_id
  -> grading_session_id đang open
  -> class_student_id
  -> create_session_submission
```

Các bước resolve qua Supabase REST:

1. `termId` đã là UUID nên không cần query lại term. Dùng nó để giới hạn class:

   ```http
   GET /rest/v1/classes?select=id,name,term_id
     &term_id=eq.{TERM_ID}
     &name=eq.{CLASS_NAME}
     &limit=2
   ```

2. Resolve lab:

   ```http
   GET /rest/v1/labs?select=id,code&code=eq.{LAB_CODE}&limit=2
   ```

3. Resolve session đang mở:

   ```http
   GET /rest/v1/grading_sessions
     ?select=id,class_id,lab_id,name,status,deadline,drive_root_url
     &class_id=eq.{CLASS_ID}
     &lab_id=eq.{LAB_ID}
     &status=eq.open
     &limit=2
   ```

Mỗi bước phải trả về đúng một dòng. Riêng bước session:

- `0` dòng: chưa có đợt chấm đang mở, dừng sync;
- `1` dòng: lấy `id` làm `grading_session_id`;
- nhiều hơn `1` dòng: lỗi dữ liệu/cấu hình, không tự chọn dòng mới nhất.

Database có unique index bảo đảm tối đa một session `open` cho một
`class_id + lab_id`, nhưng service vẫn phải kiểm tra số lượng trả về thay vì
dùng `limit=1` rồi âm thầm chọn bản ghi đầu tiên.

### 2.4 Pseudo-code cần thay trong service

```text
input = termId, className, labCode, studentCode, sourceUrl, score, details

classId = resolveClass(input.termId, normalize(input.className))
labId = resolveLab(normalize(input.labCode))
session = resolveSingleOpenSession(classId, labId)
classStudentId = resolveClassStudent(classId, normalize(input.studentCode))

call create_session_submission(
  classStudentId,
  session.id,
  sourceUrl,
  score,
  details
)
```

### 2.5 DTO và response cần đổi

Contract tối thiểu tương thích ngược:

```csharp
public record SyncSupabaseRequest(
    string? LabId,
    string? ClassName,
    string? TermId = null,
    string? GradingSessionId = null);

public record SyncSupabaseGradeRequest(
    string StudentCode,
    string ClassName,
    string LabCode,
    decimal Score,
    JsonElement Details,
    string? SourceUrl = null,
    string? TermId = null,
    string? GradingSessionId = null);

public record SyncSupabaseGradesRequest(
    string ClassName,
    string LabCode,
    IReadOnlyList<SyncSupabaseGradeItemRequest> Submissions,
    string? TermId = null,
    string? GradingSessionId = null);

public record SyncSupabaseGradeResponse(
    string ClassStudentId,
    string GradingSessionId);
```

Giữ `LabId` trong `SyncSupabaseRequest` để không phá caller cũ dù giá trị thực
tế đang được dùng như lab code. Không đổi positional record parameter trong
cùng đợt migration nếu frontend vẫn đang deserialize theo contract hiện tại.

`SyncSupabaseGradeItemResult` cũng đổi `ClassLabId` thành
`GradingSessionId`; bỏ `ItemType` và `FulfillsRequestId` vì RPC mới luôn tạo
attempt `original` và schema session không dùng resubmission flow cũ.

### 2.6 Nâng cấp payload về sau

Khuyến nghị thêm `gradingSessionId` dạng optional vào API:

```json
{
  "termId": "0d8d7a56-0000-0000-0000-000000000000",
  "className": "SE1812",
  "labCode": "LAB1",
  "gradingSessionId": "55d21bd3-b1fc-4b85-9448-9715979658ee"
}
```

Quy tắc tương thích:

```text
nếu có gradingSessionId:
  load session theo ID
  xác minh session khớp termId + className + labCode
nếu không có gradingSessionId:
  resolve đúng một session open từ termId + className + labCode
```

Cách này cho phép chuyển đổi dần mà không phá API cũ.

### 2.7 Thay đổi tương ứng trong `grading-auto-client`

Trong `src/types/lab.ts`, cập nhật contract:

```ts
export interface LabSyncSupabaseGradesRequest {
  termId?: string;
  className: string;
  labCode: string;
  gradingSessionId?: string;
  submissions: LabSyncSupabaseGradesSubmission[];
}

export interface LabSyncSupabaseGradesSyncedItem {
  studentCode: string;
  classStudentId: string;
  gradingSessionId: string;
}

export interface LabSupabaseGradingSessionOption {
  id: string;
  name: string;
  status: "open" | "closed";
  deadline: string | null;
  className: string;
  labCode: string;
  termId: string;
}
```

Trong `src/lib/api.ts`, các method và route hiện tại được giữ nguyên:

```text
syncLabAssignmentSupabase(...)
syncLabSupabaseGrade(...)
syncLabSupabaseGrades(...)
getLabSupabaseDropdownOptions(...)
```

Chỉ thay request/response type và truyền thêm `gradingSessionId`.

Trong `ResultsTab.tsx`:

1. thêm state `syncGradingSessionId`;
2. reset session khi term, class hoặc lab thay đổi;
3. chỉ hiển thị các session khớp term + class + lab;
4. yêu cầu chọn session trước khi bật nút `Start sync`;
5. truyền `gradingSessionId: syncGradingSessionId` vào
   `api.syncLabSupabaseGrades(...)`;
6. đổi nội dung modal thành “Choose the target term, class, lab, and grading
   session”.

Nếu cần triển khai theo hai giai đoạn, frontend cũ vẫn hoạt động khi backend tự
resolve đúng một session `open`. Tuy nhiên dropdown session là cách an toàn để
người dùng xác định đúng “Đợt 1”, “Đợt 2”, ... và tránh phụ thuộc vào fallback.

## 3. Cấu hình Supabase

Chỉ lưu các giá trị sau ở backend/worker, không đưa Service Role Key vào
frontend hoặc log:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

Headers dùng cho mọi request:

```http
apikey: {SUPABASE_SERVICE_ROLE_KEY}
Authorization: Bearer {SUPABASE_SERVICE_ROLE_KEY}
Content-Type: application/json
```

## 4. Gắn job chấm với session

### Cách 1 — lưu `grading_session_id` trong cấu hình job (khuyến nghị)

Khi admin tạo session, copy UUID của session vào cấu hình folder/job mà tool
theo dõi:

```json
{
  "gradingSessionId": "55d21bd3-b1fc-4b85-9448-9715979658ee",
  "className": "SE1812",
  "labCode": "LAB1",
  "watchFolder": "https://drive.google.com/drive/folders/..."
}
```

Trước khi chấm, xác minh session:

```http
GET /rest/v1/grading_sessions
  ?select=id,class_id,lab_id,name,status,deadline,drive_root_url,labs(code)
  &id=eq.{GRADING_SESSION_ID}
```

Kết quả phải có đúng một dòng.

### Cách 2 — resolve bằng Drive URL

Chỉ dùng khi session có `drive_root_url` và mỗi folder thuộc đúng một session.
Giá trị URL trong filter phải được URL-encode.

```http
GET /rest/v1/grading_sessions
  ?select=id,class_id,name,status,deadline,drive_root_url,labs(code)
  &drive_root_url=eq.{URL_ENCODED_DRIVE_ROOT_URL}
```

Nếu kết quả khác đúng một dòng, dừng job và yêu cầu cấu hình
`grading_session_id`. Không tự chọn dòng mới nhất.

### Cách 3 — fallback bằng lớp + lab đang mở

Chỉ dùng để tương thích tool cũ:

```http
GET /rest/v1/grading_sessions
  ?select=id,class_id,name,status,deadline,drive_root_url,classes!inner(name),labs!inner(code)
  &classes.name=eq.{CLASS_NAME}
  &labs.code=eq.{LAB_CODE}
  &status=eq.open
```

Quy tắc:

- `0` dòng: không có session mở, không sync;
- `1` dòng: dùng `id` làm `grading_session_id`;
- nhiều hơn `1` dòng: lỗi cấu hình, không được đoán session.

Database hiện có unique index để mỗi `class_id + lab_id` chỉ có tối đa một
session `open`, nhưng tool vẫn phải kiểm tra số lượng kết quả.

## 5. Resolve sinh viên trong đúng lớp của session

Lấy `class_id` từ session đã resolve, sau đó tìm enrollment bằng MSSV:

```http
GET /rest/v1/class_students
  ?select=id,students!inner(student_code)
  &class_id=eq.{SESSION_CLASS_ID}
  &students.student_code=eq.{STUDENT_CODE}
  &limit=2
```

Chuẩn hóa trước khi query:

```text
student_code = trim + uppercase
class_name   = trim + uppercase
lab_code     = trim + uppercase
```

Kết quả phải có đúng một dòng. Trường `id` của dòng này là
`class_student_id`, không phải `student_id`.

## 6. Kiểm tra cửa sổ chấm

Tool nên kiểm tra sớm để trả log dễ hiểu:

```text
session.status phải là open
deadline phải null hoặc lớn hơn thời gian UTC hiện tại
```

Database vẫn là nguồn quyết định cuối cùng:

- Supabase Cron đổi session quá hạn thành `closed` mỗi phút;
- trigger trên `session_submissions` chặn ngay lập tức khi qua deadline;
- vì vậy không được bỏ qua lỗi RPC dù kiểm tra phía tool vừa báo session mở.

Student vẫn có thể xem kết quả cũ của session `closed`; chỉ thao tác ghi mới bị
chặn.

## 7. Gọi RPC tạo attempt

```http
POST {SUPABASE_URL}/rest/v1/rpc/create_session_submission
Prefer: return=representation
```

```json
{
  "p_class_student_id": "b122a862-b91f-493c-989d-2d0fc53db337",
  "p_grading_session_id": "55d21bd3-b1fc-4b85-9448-9715979658ee",
  "p_source_url": "https://drive.google.com/file/d/...",
  "p_score": 8.5,
  "p_details": {
    "passed": 17,
    "total": 20,
    "build_logs": "Build succeeded",
    "tests": [
      {
        "name": "GET /api/products",
        "method": "GET",
        "url": "/api/products",
        "actual_status_code": 200,
        "passed": true,
        "score": 0.5
      }
    ],
    "grading_job_id": "job-20260716-000123"
  }
}
```

Các key UI đang hỗ trợ trong `p_details`:

- testcase array: `tests` hoặc `results`;
- build log: `build_logs`, `buildLogs` hoặc `log`;
- response: `actualResponse` hoặc `actual_response`;
- HTTP status: `actualStatusCode`, `statusCode` hoặc `actual_status_code`;
- điểm testcase: `effectiveScore`, `awardedScore` hoặc `score`.

## 8. Chống sync trùng

RPC luôn tạo một attempt mới. Vì vậy tool phải chống retry trùng trước khi gọi
RPC.

Khuyến nghị:

1. tạo một `grading_job_id` ổn định cho mỗi lần chấm;
2. lưu job đã sync thành công trong database/cache của tool;
3. chỉ đánh dấu thành công sau khi RPC trả HTTP `2xx`;
4. khi timeout không rõ kết quả, kiểm tra lại submission trước khi retry.

Có thể kiểm tra nhanh theo session, sinh viên và source URL:

```http
GET /rest/v1/session_submissions
  ?select=id,attempt_no,created_at,details
  &grading_session_id=eq.{GRADING_SESSION_ID}
  &class_student_id=eq.{CLASS_STUDENT_ID}
  &source_url=eq.{URL_ENCODED_SOURCE_URL}
  &order=attempt_no.desc
  &limit=1
```

Nếu cùng một source URL có thể được chấm lại hợp lệ, dùng `grading_job_id` của
tool làm idempotency key thay vì chỉ dựa vào URL.

## 9. Ví dụ C# tối thiểu

```csharp
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

public sealed class SupabaseSessionSync
{
    private readonly HttpClient _http;

    public SupabaseSessionSync(string supabaseUrl, string serviceRoleKey)
    {
        _http = new HttpClient { BaseAddress = new Uri(supabaseUrl.TrimEnd('/') + "/") };
        _http.DefaultRequestHeaders.Add("apikey", serviceRoleKey);
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", serviceRoleKey);
    }

    public async Task SyncAsync(
        Guid gradingSessionId,
        string studentCode,
        string? sourceUrl,
        decimal score,
        object details,
        CancellationToken cancellationToken = default)
    {
        var session = await GetSingleAsync<SessionRow>(
            $"rest/v1/grading_sessions?select=id,class_id,status,deadline" +
            $"&id=eq.{gradingSessionId}",
            "grading session",
            cancellationToken);

        if (!string.Equals(session.status, "open", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("grading_session_not_open");

        if (session.deadline is not null && session.deadline <= DateTimeOffset.UtcNow)
            throw new InvalidOperationException("grading_session_deadline_passed");

        var normalizedStudentCode = studentCode.Trim().ToUpperInvariant();
        var encodedStudentCode = Uri.EscapeDataString(normalizedStudentCode);
        var enrollment = await GetSingleAsync<ClassStudentRow>(
            $"rest/v1/class_students?select=id,students!inner(student_code)" +
            $"&class_id=eq.{session.class_id}" +
            $"&students.student_code=eq.{encodedStudentCode}&limit=2",
            "class student",
            cancellationToken);

        var payload = new
        {
            p_class_student_id = enrollment.id,
            p_grading_session_id = gradingSessionId,
            p_source_url = sourceUrl,
            p_score = score,
            p_details = details
        };

        using var response = await _http.PostAsJsonAsync(
            "rest/v1/rpc/create_session_submission",
            payload,
            cancellationToken);

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"Supabase sync failed ({(int)response.StatusCode}): {responseBody}");
    }

    private async Task<T> GetSingleAsync<T>(
        string path,
        string entityName,
        CancellationToken cancellationToken)
    {
        using var response = await _http.GetAsync(path, cancellationToken);
        response.EnsureSuccessStatusCode();

        var rows = await response.Content.ReadFromJsonAsync<List<T>>(
            cancellationToken: cancellationToken) ?? [];

        return rows.Count == 1
            ? rows[0]
            : throw new InvalidOperationException(
                $"Expected exactly one {entityName}, found {rows.Count}.");
    }

    private sealed record SessionRow(
        Guid id,
        Guid class_id,
        string status,
        DateTimeOffset? deadline);

    private sealed record ClassStudentRow(Guid id);
}
```

## 10. Lỗi cần xử lý

| Mã/thông báo | Ý nghĩa | Xử lý |
|---|---|---|
| `grading_session_not_open_or_student_not_enrolled` | Sai session, session đã đóng hoặc sinh viên không thuộc lớp | Không retry; kiểm tra mapping |
| `grading_session_not_open` | Session đã đóng | Không retry |
| `grading_session_deadline_passed` | Deadline đã qua | Không retry |
| `grading_session_not_found` | UUID session không tồn tại | Không retry; sửa cấu hình |
| HTTP `401` / `403` | Key sai hoặc không phải Service Role | Sửa secret |
| HTTP `409` | Xung đột dữ liệu | Log payload và kiểm tra attempt gần nhất trước khi retry |
| HTTP `5xx` / timeout | Lỗi tạm thời hoặc chưa rõ kết quả | Reconcile trước, sau đó exponential backoff |

Không retry vô hạn với lỗi nghiệp vụ `4xx`.

## 11. SQL kiểm tra sau sync

```sql
select
  gs.name as session_name,
  gs.status as session_status,
  c.name as class_name,
  l.code as lab_code,
  s.student_code,
  sub.attempt_no,
  sub.score,
  sub.status,
  sub.source_url,
  sub.created_at
from public.session_submissions sub
join public.grading_sessions gs on gs.id = sub.grading_session_id
join public.class_students cs on cs.id = sub.class_student_id
join public.students s on s.id = cs.student_id
join public.classes c on c.id = gs.class_id
join public.labs l on l.id = gs.lab_id
where gs.id = '{GRADING_SESSION_ID}'::uuid
order by s.student_code, sub.attempt_no desc;
```

Kiểm tra session mà tool được cấu hình:

```sql
select
  gs.id,
  gs.name,
  gs.status,
  gs.deadline,
  gs.drive_root_url,
  c.name as class_name,
  l.code as lab_code
from public.grading_sessions gs
join public.classes c on c.id = gs.class_id
join public.labs l on l.id = gs.lab_id
where gs.id = '{GRADING_SESSION_ID}'::uuid;
```

## 12. Checklist triển khai

- [ ] Mỗi folder/job lưu `grading_session_id` riêng.
- [ ] API cũ `termId + className + labCode` resolve ra đúng một session `open`.
- [ ] Không chọn session theo `created_at desc`.
- [ ] Resolve `class_student_id` bằng `session.class_id + student_code`.
- [ ] Chỉ gọi `create_session_submission`.
- [ ] Không insert trực tiếp vào `session_submissions`.
- [ ] Không dùng RPC cũ `create_class_lab_submission`.
- [ ] Chặn retry trùng bằng `grading_job_id`.
- [ ] Log `grading_session_id`, `student_code`, HTTP status và RPC error.
- [ ] Không log Service Role Key.
- [ ] Reconcile một submission thật trên Supabase trước khi bật batch sync.
