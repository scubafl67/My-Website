FROM python:3.11-slim

WORKDIR /app

COPY requirements-deploy.txt .
RUN pip install --no-cache-dir -r requirements-deploy.txt

COPY . .

CMD ["python", "main.py", "serve", "--port", "8000"]
