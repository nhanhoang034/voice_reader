import sys
import os
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# Thêm thư mục backend vào đường dẫn hệ thống để Python nhận diện các service bên trong
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

# Import trực tiếp app FastAPI từ backend/main.py
from backend.main import app as fastapi_app

# Nếu bạn có thư mục frontend ở ngoài gốc, mount nó ra (nếu không thì bỏ qua dòng này)
if os.path.exists("frontend"):
    fastapi_app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(fastapi_app, host="0.0.0.0", port=7860)