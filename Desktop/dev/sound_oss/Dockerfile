FROM python:3.11-slim

WORKDIR /app

# 音声処理に必要なシステムパッケージ
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY *.py .

EXPOSE 7860

CMD ["python", "app.py"]
