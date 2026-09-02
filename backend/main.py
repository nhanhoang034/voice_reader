import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from pdf_service import extract_and_clean_pdf
from docx_service import extract_and_clean_docx
from tts_service import synthesize_speech

app = FastAPI(title="Doc Voice Reader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TTSRequest(BaseModel):
    text: str
    voice: str = "vi-VN-HoaiMyNeural"
    rate: str = "+0%"

@app.post("/api/extract-pdf")
async def extract_pdf_endpoint(file: UploadFile = File(...)):
    try:
        content = await file.read()
        return extract_and_clean_pdf(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc PDF: {str(e)}")

@app.post("/api/extract-docx")
async def extract_docx_endpoint(file: UploadFile = File(...)):
    try:
        content = await file.read()
        return extract_and_clean_docx(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc Word: {str(e)}")

@app.post("/api/tts")
async def generate_speech_endpoint(req: TTSRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Văn bản trống")
    try:
        audio_stream = await synthesize_speech(req.text, req.voice, req.rate)
        return StreamingResponse(audio_stream, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Mount thư mục frontend để hiển thị giao diện web trực tiếp tại trang chủ
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)