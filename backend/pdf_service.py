import pymupdf
import re
from text_utils import split_and_log_sentences
from collections import Counter

def extract_and_clean_pdf(file_bytes: bytes) -> dict:
    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    total_pages = len(doc)
    all_sentences = []

    for page_num in range(total_pages):
        page = doc[page_num]
        display_page = page_num + 1
        page_height = page.rect.height

        raw_data = page.get_text("rawdict")
        blocks = [b for b in raw_data.get("blocks", []) if b.get("type") == 0]

        # Sắp xếp các block theo tọa độ đọc tự nhiên: ưu tiên Y (từ trên xuống), nếu gần ngang hàng thì xếp theo X (từ trái qua phải)
        blocks.sort(key=lambda b: (round(b.get("bbox", [0, 0, 0, 0])[1] / 30) * 30, b.get("bbox", [0, 0, 0, 0])[0]))

        # Tìm font size chủ đạo
        font_sizes = []
        for block in blocks:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span.get("text", "").strip():
                        font_sizes.append(round(span.get("size", 12), 1))

        body_font_size = Counter(font_sizes).most_common(1)[0][0] if font_sizes else 12.0

        page_lines = []
        for block in blocks:
            for line in block.get("lines", []):
                line_words = []
                prev_char_bbox = None
                line_font_sizes = []

                for span in line.get("spans", []):
                    font_size = span.get("size", 12)
                    space_threshold = font_size * 0.18

                    for char_info in span.get("chars", []):
                        ch = char_info.get("c", "")
                        bbox = char_info.get("bbox", [0, 0, 0, 0])

                        line_font_sizes.append(font_size)

                        if prev_char_bbox is not None:
                            char_gap = bbox[0] - prev_char_bbox[2]
                            if char_gap > space_threshold and not (line_words and line_words[-1] == " "):
                                line_words.append(" ")

                        line_words.append(ch)
                        prev_char_bbox = bbox

                line_text = "".join(line_words).strip()
                if not line_text:
                    continue

                line_y = line.get("bbox", [0, 0, 0, 0])[1]

                # Bỏ qua số trang lẻ đứng độc lập
                if page_num > 0 and re.match(r'^\d{1,3}$', line_text):
                    continue

                # Chỉ xóa số trang nếu ký tự tiếp theo là chữ in hoa (tiêu đề trang)
                if page_num > 0:
                    line_text = re.sub(r'^\d{1,2}\s+(?=[A-ZÀ-Ỹ])', '', line_text).strip()

                # Kiểm tra Footnote (font nhỏ hơn >= 1.5pt ở đáy trang)
                avg_line_font = sum(line_font_sizes) / len(line_font_sizes) if line_font_sizes else body_font_size
                if page_num > 0 and line_y > (page_height * 0.65) and (body_font_size - avg_line_font >= 1.5):
                    continue

                if line_text:
                    page_lines.append(line_text)

        full_page_text = " ".join(page_lines)
        page_sentences = split_and_log_sentences(full_page_text, page_num=display_page, label="PDF")
        all_sentences.extend(page_sentences)

    return {"pages": total_pages, "items": all_sentences}