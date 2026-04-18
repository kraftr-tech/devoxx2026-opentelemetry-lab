FROM python:3.13-slim
WORKDIR /app
COPY users-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY users-service/ .
EXPOSE 8001
CMD ["gunicorn", "--bind", "0.0.0.0:8001", "app:app"]
