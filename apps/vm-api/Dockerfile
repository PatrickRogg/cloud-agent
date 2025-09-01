FROM oven/bun:1.2.21

# Set arguments
ARG APP_PATH='apps/mcp-server'
ARG APP_NAME='@repo/mcp-server'

# Install dependencies
RUN bun install --global pnpm@10.12.4

# Set working directory
WORKDIR /usr/src/app

# Copy the rest of the application code
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Run typechecking
RUN pnpm --filter ${APP_NAME} typecheck

# Set final working directory
WORKDIR /usr/src/app/${APP_PATH}

# Start the application
CMD ["pnpm", "start"]