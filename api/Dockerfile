# Build from the repo root: docker build -f api/Dockerfile -t shrimpcount-api .
# Hugging Face Spaces (Docker) expects port 7860.
FROM python:3.11-slim
WORKDIR /app
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api api
COPY training/tiling.py training/tiling.py
COPY model model
ENV MODEL_PATH=model/best.onnx
EXPOSE 7860
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
