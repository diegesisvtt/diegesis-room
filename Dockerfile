# syntax=docker/dockerfile:1
FROM oven/bun:1

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Runtime files only — the server bundle (dist-server/index.js) is
# self-contained and only needs the Bun runtime (already in the image).
COPY dist ./dist
COPY dist-server ./dist-server
COPY drizzle ./drizzle

# SQLite database lives here; created at runtime by the app.
# Mount a named volume at /app/data to persist it across restarts.
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["bun", "dist-server/index.js"]
