---
name: PRN232 Auto Grading
description: Bảng điều khiển chẩn đoán trực quan kết quả chấm bài lab môn PRN232.
colors:
  primary: "#ea580c"
  secondary: "#c2410c"
  accent: "#f59e0b"
  neutral-bg: "#ffffff"
  neutral-fg: "#0c0a09"
  border: "#e5e7eb"
  muted: "#f3f4f6"
  muted-foreground: "#6b7280"
typography:
  display:
    fontFamily: "var(--font-open-sans), sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "var(--font-quicksand), sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
---

# Design System: PRN232 Auto Grading

## 1. Overview

**Creative North Star: "The Diagnostic Console"**

Hệ thống thiết kế của PRN232 Auto Grading tập trung vào tính rõ ràng, chuẩn xác và khả năng điều hướng tối ưu cho sinh viên lẫn giáo viên. Lấy cảm hứng từ các bảng điều khiển chẩn đoán lập trình chuyên nghiệp, hệ thống này loại bỏ hoàn toàn các trang trí dư thừa để nhường chỗ cho dữ liệu điểm số và thông tin logs chấm bài. 

Aesthetic chủ đạo là sự kết hợp giữa nét ấm áp, chuyên nghiệp từ màu cam/vàng cát công nghệ và sự ngăn nắp, rõ ràng của cấu trúc thông tin phẳng (Flat/Layered).

**Key Characteristics:**
- **Thông tin là cốt lõi**: Điểm số, trạng thái bài lab và logs lỗi được đặt ở trung tâm thị giác.
- **Tính đối lập màu sắc**: Sử dụng các mảng màu thương hiệu (Orange/Amber) để dẫn dắt hành động, kết hợp với các chỉ báo màu sắc rõ ràng (Xanh lá cho Pass, Đỏ cho Fail).
- **Tối giản thị giác**: Sử dụng các đường viền 1px tinh tế thay cho các mảng đổ bóng đậm để phân chia không gian.

## 2. Colors

Bảng màu được thiết kế theo chiến lược **Committed**, sử dụng màu cam sáng và vàng hổ phách để định vị thương hiệu, kết hợp với các tông màu trung tính sạch sẽ ở cả giao diện sáng (Light) và tối (Dark).

### Primary
- **Vibrant Orange** (#ea580c): Được sử dụng làm màu chủ đạo cho các hành động chính, nút kêu gọi hành động (CTA), và tiêu đề quan trọng.

### Secondary
- **Dark Orange** (#c2410c): Sử dụng cho trạng thái di chuột (hover) của các thành phần chính và các phần tử bổ trợ mang tính thương hiệu.

### Tertiary
- **Warm Amber** (#f59e0b): Sử dụng để nhấn mạnh (highlight) các trạng thái active hoặc các tag quan trọng.

### Neutral
- **Paper Background** (#ffffff / #0c0a09): Màu nền chính cho trang, tạo sự dễ chịu khi đọc trong thời gian dài.
- **Deep Ink** (#0c0a09 / #fafaf9): Màu chữ chính, đảm bảo độ tương phản cao đạt chuẩn WCAG AA.
- **Slate Muted** (#f3f4f6 / #292524): Màu nền cho các thẻ logs, code block và các vùng thông tin phụ trợ.
- **Light Border** (#e5e7eb / #292524): Đường phân cách mỏng 1px tinh tế.

**The Contrast Rule.** Mọi văn bản hiển thị thông tin điểm số hoặc logs phải đạt tỷ lệ tương phản tối thiểu 4.5:1 so với nền tương ứng để đảm bảo khả năng đọc tốt nhất dưới mọi điều kiện ánh sáng.

## 3. Typography

**Display Font:** Open Sans (với fallback sans-serif)
**Body Font:** Quicksand (với fallback sans-serif)
**Label/Mono Font:** Fira Code (hoặc JetBrains Mono, SF Mono, monospace)

Sự kết hợp giữa Open Sans vững chãi cho tiêu đề và Quicksand bo tròn nhẹ nhàng cho nội dung tạo nên cảm giác hiện đại nhưng vẫn dễ tiếp cận.

### Hierarchy
- **Display** (Bold (700), clamp(1.75rem, 5vw, 2.25rem), 1.2): Dùng cho tiêu đề trang chính, bảng điều khiển tổng quan.
- **Headline** (SemiBold (600), 1.5rem, 1.3): Dùng cho tiêu đề của các bài lab, các phần lớn.
- **Title** (Medium (500), 1.125rem, 1.4): Dùng cho tiêu đề card, nhãn bảng dữ liệu.
- **Body** (Regular (400), 1rem, 1.5): Dùng cho thông tin mô tả, phản hồi của giảng viên. Giới hạn độ rộng dòng tối đa là 75ch.
- **Label** (Medium (500), 0.875rem, 1.2): Dùng cho các thẻ tag trạng thái, logs testcase, và chú thích.

**The Monospace Code Rule.** Toàn bộ logs chấm bài tự động và kết quả testcase phải được hiển thị bằng font chữ monospace có kích thước tối thiểu là 14px để phục vụ quá trình chẩn đoán lỗi hiệu quả.

## 4. Elevation

Hệ thống thiết kế tuân thủ nguyên lý **Tối giản & Phẳng (Flat/Layered)**. Chúng tôi hạn chế tối đa việc sử dụng các bóng đổ lớn để tránh gây rối mắt cho người dùng khi có nhiều thông tin hiển thị đồng thời.

### Shadow Vocabulary
- **Flat at Rest**: Các thẻ card, bảng biểu không có bóng đổ, được phân tách bằng đường viền 1px mỏng (#e5e7eb hoặc #292524).
- **Interactive Shadow** (0 4px 12px rgba(12, 10, 9, 0.05)): Chỉ xuất hiện khi di chuột qua các thẻ bài lab có thể nhấp chọn để tạo phản hồi vật lý nhẹ nhàng.

**The Borders-Over-Shadows Rule.** Phân cấp các vùng thông tin bằng cách sử dụng các sắc độ màu nền (Slate Muted) và đường viền mỏng 1px thay vì sử dụng hiệu ứng đổ bóng.

## 5. Components

### Buttons
- **Shape:** Bo góc vừa phải (6px)
- **Primary:** Nền màu Vibrant Orange (#ea580c), chữ trắng, padding (8px 16px)
- **Hover / Focus:** Chuyển sang nền Dark Orange (#c2410c) với hiệu ứng transition mượt mà (150ms).
- **Secondary / Outline:** Nền trong suốt, viền mỏng (#e5e7eb), chữ màu Deep Ink. Khi hover, nền chuyển sang màu Slate Muted.

### Cards / Containers
- **Corner Style:** Bo góc lớn (8px)
- **Background:** Nền màu Paper Background (#ffffff / #1c1917)
- **Border:** Viền mỏng 1px (#e5e7eb / #292524)
- **Internal Padding:** Spacing trung bình (16px hoặc 24px) tùy thuộc vào mật độ thông tin.

### Inputs / Fields
- **Style:** Viền mỏng 1px (#e5e7eb), bo góc 6px, nền trong suốt.
- **Focus:** Viền chuyển sang màu Vibrant Orange (#ea580c) cùng một lớp viền ngoài mỏng (ring).
- **Error:** Viền chuyển sang màu đỏ Destructive (#ef4444).

### Navigation
- **Style:** Thanh điều hướng cố định trên cùng (top nav) với nền mờ acrylic (backdrop-blur) tinh tế, đảm bảo luôn hiển thị lối thoát về trang chủ và thông tin người dùng đăng nhập.

## 6. Do's and Don'ts

### Do:
- **Do** sử dụng font chữ monospace cho toàn bộ kết quả testcases và debug logs.
- **Do** đảm bảo nút đăng nhập bằng Google hiển thị rõ logo Google chính thức và chỉ cho phép email sinh viên đăng nhập.
- **Do** sử dụng đúng các mã màu quy định cho trạng thái bài làm (Xanh lá cho Passed, Đỏ cho Failed, Vàng cho Pending).

### Don't:
- **Don't** sử dụng hiệu ứng glassmorphic quá mức làm mờ hoặc khó đọc logs lỗi.
- **Don't** sử dụng viền màu (border-left/right dày) để phân biệt thẻ trạng thái bài lab; thay vào đó hãy sử dụng chip trạng thái hoặc màu nền thẻ.
- **Don't** sử dụng cỡ chữ nhỏ hơn 12px cho bất kỳ nhãn hoặc thông tin logs nào.
