# DichTruyenPro - Hệ Thống Dịch Truyện Chữ Hàng Loạt Chuẩn 100% Xưng Hô bằng Gemini AI

Phần mềm dịch thuật tiểu thuyết mạng Trung Quốc (Truyện chữ, Convert, QuickTranslator / Vietphrase) sang tiếng Việt chất lượng văn học cao cấp, chuẩn xác 100% ngôi xưng hô, sạch lỗi tiếng Trung, tự động hóa toàn diện và xuất bản ngay lập tức.

---

## 🌟 Các Tính Năng Đột Phá

1. **Chuẩn Hóa 100% Xưng Hô & Ngôi Nhân Vật (Persona & Relationship Matrix)**:
   - Ma trận xưng hô giữa từng cặp nhân vật (Ai nói với ai, người nói xưng gì, gọi người nghe là gì).
   - Thiết lập thể loại bối cảnh (Tiên hiệp, Đô thị, Ngôn tình, Cổ đại, Cung đấu, Võ hiệp...).
   - **⚡ AI Auto-Scan**: Tự động đọc các chương đầu để trích xuất toàn bộ nhân vật, quan hệ và đề xuất ma trận xưng hô chỉ bằng 1 cú nhấp chuột.
   - Hỗ trợ nhập và xuất file từ điển Vietphrase / QuickTranslator (`Names.txt`).

2. **Quy Trình Dịch 4 Lớp Chống Lỗi (Zero-Error Pipeline)**:
   - **Context Continuity**: Tự động lưu tóm tắt ngắn sau mỗi chương dịch để truyền nối tiếp sang chương sau, giúp mạch truyện và xưng hô không bao giờ bị đứt gãy.
   - **Linter & Post-Processor**: Tự động phát hiện và cảnh báo chữ Hán còn sót, sửa các lỗi dịch máy thô (như *"của hắn đích"*, *"một cái thiếu niên"*, *"thời điểm đó"*).

3. **Quản Lý Đa API Key Gemini (Load Balancing & Auto-Retry)**:
   - Nhập không giới hạn Gemini API key.
   - Tự động xoay tua (Round-Robin) giữa các key.
   - Tự động bắt lỗi Rate Limit (HTTP 429), chuyển key và backoff thông minh.
   - Hỗ trợ các model Gemini: `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`.

4. **Xưởng Dịch Hàng Loạt (Batch Translation Studio)**:
   - Tự động nhận diện và bóc tách các chương (`第...章`, `Chương...`, `Hồi...`).
   - Tải lên file `.txt` dung lượng lớn (lên tới 50MB) hoặc dán trực tiếp.
   - Hàng đợi dịch với thanh tiến trình trực quan, hỗ trợ Tạm dừng (Pause) / Tiếp tục (Resume) / Dịch lại chương lỗi.

5. **Bộ So Sánh Đối Chiếu & Biên Tập Trực Tiếp (Side-by-Side Editor)**:
   - Đọc đối chiếu song song: Tiếng Trung gốc bên trái - Tiếng Việt bên phải.
   - Cho phép chỉnh sửa trực tiếp và lưu ngay lập tức.

6. **Xuất Bản Đa Định Dạng Sẵn Sàng Đọc (Export Center)**:
   - 📄 **File TXT Gộp Toàn Bộ**: Một file duy nhất có mục lục rõ ràng.
   - 📦 **File ZIP Từng Chương Rời**: Đóng gói các chương `0001_Chuong_1.txt` riêng biệt.
   - 📘 **Sách Điện Tử EPUB**: Chuẩn EPUB kèm Table of Contents (mục lục) đọc mượt mà trên Apple Books, Kindle, Kobo, Moon+ Reader.
   - 📝 **File Microsoft Word (DOCX)**: Định dạng sẵn Heading 1 cho tiêu đề chương và căn đoạn văn học chuẩn.
   - 📑 **File Từ Điển Vietphrase (Names.txt)**: Tái sử dụng cho các bộ truyện khác.

---

## 🚀 Hướng Dẫn Khởi Chạy

### Cách 1: Chạy bằng file `start.bat`
- Nhấp đúp chuột vào file `start.bat` trong thư mục dự án.
- Trình duyệt sẽ tự động mở trang web: `http://localhost:3001`.

### Cách 2: Khởi chạy bằng lệnh dòng lệnh
```bash
# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi động server
npm start
```
Truy cập: `http://localhost:3001`

---

## 📖 Hướng Dẫn Sử Dụng Chi Tiết

1. **Cấu hình Gemini API Key**:
   - Nhấp vào nút **API Keys** ở góc trên bên phải giao diện.
   - Dán 1 hoặc nhiều API Key lấy từ [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Nhấp **Kiểm tra** để xác nhận key hoạt động tốt.

2. **Nạp Truyện**:
   - Trong tab **Xưởng Dịch Hàng Loạt**, bấm **Thêm / Nạp Chương**.
   - Kéo thả file `.txt` truyện Trung Quốc hoặc dán văn bản. Hệ thống sẽ tự bóc tách thành từng chương.

3. **Quét Nhân Vật & Thiết Lập Xưng Hô**:
   - Chuyển sang tab **Ma Trận Xưng Hô & Từ Điển**.
   - Bấm **⚡ AI Quét Tự Động Nhân Vật**: AI sẽ phân tích ngay các chương đầu và điền bảng nhân vật + ma trận xưng hô cho bạn.
   - Bạn có thể chỉnh sửa hoặc thêm quy tắc nếu muốn.

4. **Bắt Đầu Dịch Hàng Loạt**:
   - Quay lại tab **Xưởng Dịch Hàng Loạt**, bấm **Dịch Tất Cả Chưa Dịch**.
   - Hệ thống sẽ tự động chạy hàng loạt, hiển thị % tiến độ và nhật ký chi tiết.

5. **Xuất Bản File**:
   - Bấm **Xuất File** ở thanh trên cùng.
   - Chọn định dạng mong muốn: TXT, ZIP, EPUB hoặc DOCX để tải về ngay lập tức!
