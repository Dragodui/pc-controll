# Use a base image with Go and necessary build tools
FROM golang:1.24-bookworm AS builder

# Install system dependencies required by robotgo
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libx11-dev \
        libxtst-dev \
        libpng-dev \
        xserver-xorg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy module files and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code
COPY . .

# Build the application
# CGO_ENABLED=1 is required for robotgo
RUN CGO_ENABLED=1 GOOS=linux go build -o server ./cmd/*

# Use a lightweight Debian image for the final container
FROM debian:bookworm-slim

# Install runtime dependencies for X11
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libx11-6 \
        libxtst6 \
        libpng16-16 \
        ydotool \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/server .

# Expose the default WebSocket port. The server still uses WS_PORT at runtime.
EXPOSE 1212

# Run ydotoold when it is available, then start the server.
CMD ["sh", "-c", "if command -v ydotoold >/dev/null 2>&1; then ydotoold --socket-path=/tmp/.ydotool_socket & fi; exec ./server"]
