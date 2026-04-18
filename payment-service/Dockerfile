FROM python:3.13-slim
WORKDIR /app
COPY payment-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY proto/transaction.proto /proto/transaction.proto
RUN python -m grpc_tools.protoc -I/proto --python_out=/app --grpc_python_out=/app /proto/transaction.proto
COPY payment-service/ .
EXPOSE 8003
CMD ["gunicorn", "--bind", "0.0.0.0:8003", "app:app"]
