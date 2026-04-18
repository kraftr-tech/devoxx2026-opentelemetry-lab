FROM golang:1.25-alpine AS builder
RUN apk add --no-cache protobuf
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
WORKDIR /app
COPY bank-service/go.mod bank-service/go.sum ./
RUN go mod download
COPY proto/transaction.proto /proto/transaction.proto
RUN mkdir -p pb && protoc -I/proto --go_out=pb --go_opt=paths=source_relative \
    --go-grpc_out=pb --go-grpc_opt=paths=source_relative /proto/transaction.proto
COPY bank-service/*.go ./
RUN CGO_ENABLED=0 go build -o /bank-service .

FROM alpine:3.21
COPY --from=builder /bank-service /bank-service
EXPOSE 50051
CMD ["/bank-service"]
