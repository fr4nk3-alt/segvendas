FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SEG_CLOUD=1 \
    PORT=8080

WORKDIR /app

COPY . /app

# A plataforma monta o volume persistente exatamente neste diretório.
RUN mkdir -p /app/data/backups /app/data/fotos_produtos /app/data/fotos_perfil

EXPOSE 8080

CMD ["python", "servidor.py"]
