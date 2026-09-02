import sys
import os

# Thêm thư mục backend vào đường dẫn hệ thống để Python nhận diện các service bên trong
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from backend.main import app
