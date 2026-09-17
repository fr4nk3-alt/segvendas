FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SEG_CLOUD=1 \
    PORT=8080

WORKDIR /app

# Instalar git para baixar código
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Baixar código do GitHub
RUN git clone --depth 1 --branch main https://github.com/fr4nk3-alt/segvendas.git /tmp/segvendas && \
    cp -r /tmp/segvendas/* /app/ && \
    rm -rf /tmp/segvendas

# Criar diretórios de dados
RUN mkdir -p /app/data/backups /app/data/fotos_produtos /app/data/fotos_perfil

EXPOSE 8080

CMD ["python", "servidor.py"]
