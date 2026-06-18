FROM golang:1.24-bookworm AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -tags pcinput -o server ./cmd

FROM debian:bookworm-slim

WORKDIR /root/

COPY --from=builder /app/server .

EXPOSE 1212

CMD ["./server"]
