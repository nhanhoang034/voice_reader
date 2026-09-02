import io
import re
import edge_tts
from num2words import num2words

def clean_special_symbols_for_tts(text: str) -> str:
    """Loại bỏ ký tự lạ khiến TTS đọc ra âm thanh không mong muốn (™ -> 'thương hiệu', ngoặc kép lạ, v.v.)"""
    # 1. Loại bỏ các ký hiệu nhãn hiệu, bản quyền
    text = re.sub(r'[™®©]', '', text)
    
    # 2. Thay thế toàn bộ các biến thể ngoặc kép thành khoảng trắng hoặc dấu phẩy nhẹ
    text = re.sub(r'[\u201C\u201D\u2018\u2019"«»`\']', ' ', text)

    # 3. Chuẩn hóa khoảng trắng thừa
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def convert_numbers_to_vietnamese_words(text: str) -> str:
    """Chuyển đổi các con số từ 2 chữ số trở lên thành chữ tiếng Việt chuẩn xác."""
    def replace_num(match):
        raw_num_str = match.group(0)
        clean_str = raw_num_str.replace('.', '').replace(',', '')
        try:
            val = int(clean_str)
            if val >= 10 or val < 0:
                return num2words(val, lang='vi')
            return raw_num_str
        except Exception:
            return raw_num_str

    pattern = r'\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{2,}\b'
    return re.sub(pattern, replace_num, text)

async def synthesize_speech(text: str, voice: str = "vi-VN-HoaiMyNeural", rate: str = "1.25") -> io.BytesIO:
    """Gọi Edge-TTS sau khi làm sạch ký tự lạ và chuẩn hóa số, hỗ trợ tùy chỉnh tốc độ động."""
    cleaned = clean_special_symbols_for_tts(text)
    
    # Chỉ áp dụng đọc số bằng chữ tiếng Việt nếu là giọng tiếng Việt
    if voice.startswith("vi-"):
        text_to_read = convert_numbers_to_vietnamese_words(cleaned)
    else:
        text_to_read = cleaned
    
    # Chuyển đổi định dạng tốc độ từ UI (ví dụ: "1.25" -> "+25%", "1" -> "+0%", "0.5" -> "-50%")
    try:
        rate_float = float(rate)
        rate_percent = int((rate_float - 1.0) * 100)
        rate_str = f"+{rate_percent}%" if rate_percent >= 0 else f"{rate_percent}%"
    except ValueError:
        rate_str = "+25%"

    communicate = edge_tts.Communicate(text=text_to_read, voice=voice, rate=rate_str)
    audio_stream = io.BytesIO()
    
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_stream.write(chunk["data"])
            
    audio_stream.seek(0)
    return audio_stream