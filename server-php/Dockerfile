FROM php:8.5-cli-alpine AS runtime

WORKDIR /app

RUN apk add --no-cache wget

COPY . /app

EXPOSE 3001

ENV PORT=3001 \
    DATABASE_PATH=/app/data/app.db \
    UPLOADS_DIR=/app/data/uploads

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=3001"]
