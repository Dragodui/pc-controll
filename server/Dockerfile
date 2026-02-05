# Use a base image with Go and necessary build tools
FROM golang:1.24-alpine AS builder

# Install system dependencies required by robotgo
RUN apk add --no-cache \
    gcc \
    libc-dev \
    libx11-dev \
    libxtst-dev \
    libpng-dev \
    xorg-server-dev

WORKDIR /app

# Copy module files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# CGO_ENABLED=1 is required for robotgo
RUN CGO_ENABLED=1 GOOS=linux go build -o server ./cmd/main.go

# Use a lightweight Alpine image for the final container
FROM alpine:latest

# Install runtime dependencies for X11
RUN apk add --no-cache \
    libx11 \
    libxtst \
    libpng \
    xorg-server

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/server .

# Expose the WebSocket port
EXPOSE 8080

# Run the server
CMD ["./server"]
