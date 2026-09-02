import re
import unicodedata

def clean_extracted_text(text: str) -> str:
    """Chuẩn hóa tổng quát: NFC, xóa biểu tượng rác, footnote, URL (Hoàn toàn tổng quát, không làm mất nội dung)."""
    if not text:
        return ""
    
    # 1. Đưa về Unicode NFC chuẩn
    text = unicodedata.normalize('NFC', text)
    text = text.replace('\u00A0', ' ').replace('\u200b', '').replace('\ufeff', ' ')
    
    # 2. Xóa biểu tượng hình vẽ / bullet point rác (giữ lại + cho C++)
    text = re.sub(r'[•▪▫·◦>|/]', ' ', text)
    
    # 3. Chuyển đổi ký tự % thành "phần trăm" để giọng đọc TTS phát âm chuẩn tiếng Việt
    text = text.replace('%', ' phần trăm ')
    
    # 4. Dọn dấu chấm lửng mục lục (vd: ..... 12)
    text = re.sub(r'\.{3,}', ' ', text)

    # 5. Xóa đường dẫn web / URL độc lập (nếu có)
    text = re.sub(r'https?://\S+', '', text)

    # 6. Xóa dòng chú thích ảnh đơn thuần nằm riêng biệt (nếu có) một cách an toàn
    text = re.sub(r'^\s*Hình:\s*.*$', '', text, flags=re.MULTILINE)

    # 7. Xóa số trích dẫn footnote một cách an toàn:
    text = re.sub(r'[\(\[]\s*\d+\s*[\)\]]', '', text)
    text = re.sub(r'[¹²³⁴⁶⁷⁸⁹⁰]+', '', text)
    text = re.sub(r'(?<=[”"\'’a-zA-Zà-ỹÀ-Ỹ])\d+(?=[.,?!;:]|\s|$)', '', text)
    text = re.sub(r'(?<=\))\d+(?=\s+[A-ZÀ-Ỹa-zà-ỹ]|\s*$)', '', text)

    # 8. Gộp khoảng trắng thừa
    return re.sub(r'\s+', ' ', text).strip()

def split_and_log_sentences(raw_text: str, page_num: int = 1, label: str = "DOC", debug: bool = False) -> list:
    """Tách câu chuẩn theo ngữ pháp tiếng Việt, bảo toàn toàn bộ nội dung."""
    cleaned = clean_extracted_text(raw_text)
    if not cleaned:
        return []

    # 1. Bảo vệ số thập phân (2,2; 3,2; 1.1; 2.3.1)
    protected = re.sub(r'(?<=\d)\.(?=\d)', '___DOT___', cleaned)

    # 2. Bảo vệ từ viết tắt chuẩn tiếng Việt
    protected = re.sub(r'\b(TP|ThS|TS|GS|PGS|BS|TAND|tr|đ/c)\.(?=\s+)', r'\1___DOT___', protected)

    # 3. Tách câu chuẩn: ngắt sau [.?!] khi phía sau là khoảng trắng và chữ cái viết hoa đầu câu mới
    raw_sentences = re.split(r'(?<=[.?!])\s+(?=[A-ZÀ-Ỹ0-9])', protected)

    sentences = []
    for s in raw_sentences:
        s_restored = s.replace("___DOT___", ".").strip()
        
        # Bỏ qua dòng rỗng hoặc quá ngắn
        if len(s_restored) > 2 and any(c.isalnum() for c in s_restored):
            sentences.append({
                "page": page_num,
                "text": s_restored
            })

    # Chỉ in ra terminal khi bật debug=True
    if debug and sentences:
        print(f"\n{'='*20} DANH SÁCH CÂU {label} (Trang {page_num} - {len(sentences)} câu) {'='*20}")
        for i, s in enumerate(sentences):
            print(f"[{i+1}] {s['text']}")
        print(f"{'='*60}\n")

    return sentences