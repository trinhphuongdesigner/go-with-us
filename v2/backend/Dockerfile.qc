FROM ghcr.io/astral-sh/uv:0.10.11 AS uv
FROM python:3.12-slim-bookworm AS dependencies
COPY --from=uv /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

FROM python:3.12-slim-bookworm AS runtime
ENV PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-vie \
    && apt-get clean && useradd --create-home --uid 10001 qc \
    && mkdir -p /app/uploads && chown qc:qc /app/uploads
WORKDIR /app
COPY --from=dependencies /app/.venv /app/.venv
COPY --chown=qc:qc backend/app ./app
COPY --chown=qc:qc backend/alembic ./alembic
COPY --chown=qc:qc backend/alembic.ini ./alembic.ini
COPY --chown=qc:qc backend/scripts ./scripts
USER qc
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
