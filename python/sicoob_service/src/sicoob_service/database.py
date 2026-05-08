"""Conexão PostgreSQL: pool, schema e operações de interações."""

from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from typing import Any

import psycopg2
from psycopg2.pool import ThreadedConnectionPool

logger = logging.getLogger(__name__)

_pool: ThreadedConnectionPool | None = None


def init_pool(database_url: str) -> None:
    global _pool
    _pool = ThreadedConnectionPool(1, 10, database_url)
    _create_schema()
    logger.info("PostgreSQL: pool inicializado")


def _create_schema() -> None:
    with _conn() as conn, conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS interacoes (
                id        SERIAL PRIMARY KEY,
                telefone  TEXT        NOT NULL,
                evento    TEXT        NOT NULL,
                cpf       TEXT,
                detalhes  JSONB,
                criado_em TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_interacoes_telefone
                ON interacoes(telefone);
            CREATE INDEX IF NOT EXISTS idx_interacoes_cpf
                ON interacoes(cpf);
            CREATE INDEX IF NOT EXISTS idx_interacoes_criado_em
                ON interacoes(criado_em);
        """)
        conn.commit()


@contextmanager
def _conn():
    conn = _pool.getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def inserir(
    telefone: str,
    evento: str,
    cpf: str | None,
    detalhes: dict[str, Any] | None,
) -> None:
    if _pool is None:
        return
    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO interacoes (telefone, evento, cpf, detalhes) VALUES (%s, %s, %s, %s)",
            (telefone, evento, cpf, json.dumps(detalhes) if detalhes else None),
        )
        conn.commit()


def consultar(
    telefone: str | None,
    cpf: str | None,
    evento: str | None,
    data_inicio: str | None,
    data_fim: str | None,
    limite: int,
) -> list[dict[str, Any]]:
    if _pool is None:
        return []
    conditions: list[str] = []
    params: list[Any] = []

    if telefone:
        conditions.append("telefone = %s")
        params.append(telefone)
    if cpf:
        conditions.append("cpf = %s")
        params.append(cpf)
    if evento:
        conditions.append("evento = %s")
        params.append(evento)
    if data_inicio:
        conditions.append("criado_em >= %s")
        params.append(data_inicio)
    if data_fim:
        conditions.append("criado_em <= %s")
        params.append(data_fim + " 23:59:59")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limite)

    with _conn() as conn, conn.cursor() as cur:
        cur.execute(
            f"SELECT id, telefone, evento, cpf, detalhes, criado_em "
            f"FROM interacoes {where} ORDER BY criado_em DESC LIMIT %s",
            params,
        )
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
