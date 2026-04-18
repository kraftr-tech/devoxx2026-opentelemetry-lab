FROM python:3.13-slim
WORKDIR /app
COPY billing-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY billing-service/ .
EXPOSE 8004
CMD ["gunicorn", "--bind", "0.0.0.0:8004", "app:app"]
