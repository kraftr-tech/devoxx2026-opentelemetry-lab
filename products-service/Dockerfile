FROM python:3.13-slim
WORKDIR /app
COPY products-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY products-service/ .
EXPOSE 8002
CMD ["gunicorn", "--bind", "0.0.0.0:8002", "app:app"]
