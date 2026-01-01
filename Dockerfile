# Gunakan Python Image yang ringan
FROM python:3.9-slim

# Set working directory
WORKDIR /app

# Copy dependency file
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh folder project
COPY . .

# Masuk ke folder script dan jalankan bridge_ml.py
# Kita bind port 7860 (Default Hugging Face) agar dianggap aktif
ENV PORT=7860
CMD ["sh", "-c", "cd Machine_Learning/scripts && python bridge_ml.py"]
