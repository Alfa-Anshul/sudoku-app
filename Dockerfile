FROM node:20-slim AS builder
WORKDIR /build
COPY package.json vite.config.js index.html ./
COPY src ./src
RUN npm install --legacy-peer-deps
RUN npx vite build

FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
COPY --from=builder /build/dist ./static
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
