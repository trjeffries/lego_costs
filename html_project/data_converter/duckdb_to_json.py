import json
import math
import os
import tempfile
from datetime import date, datetime
from pathlib import Path

import duckdb


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = PROJECT_ROOT / "dbt_project" / "dev.duckdb"
OUTPUT_DIR = PROJECT_ROOT / "html_project" / "assets"
TABLES = {
    "annual_aggregate": "year",
    "full_output": "released, set_number",
}
BIG_MAC_GBP_ANNUAL_QUERY = """
SELECT
    YEAR(date) AS year,
    date AS observed_date,
    local_price AS price_gbp
FROM big_mac_adjusted
WHERE currency_code = 'GBP' AND local_price IS NOT NULL
QUALIFY ROW_NUMBER() OVER (PARTITION BY YEAR(date) ORDER BY date) = 1
ORDER BY year
"""


def json_safe(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def export_query(connection, query):
    cursor = connection.execute(query)
    columns = [column[0] for column in cursor.description]
    rows = [
        {column: json_safe(value) for column, value in zip(columns, row)}
        for row in cursor.fetchall()
    ]
    return rows


def export_table(connection, table, order_by):
    return export_query(connection, f"SELECT * FROM {table} ORDER BY {order_by}")


def write_json(path, rows):
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as output:
            temporary_path = Path(output.name)
            json.dump(rows, output, ensure_ascii=False, allow_nan=False)
            output.write("\n")
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def main():
    if not DB_PATH.is_file():
        raise FileNotFoundError(f"dbt database not found: {DB_PATH}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with duckdb.connect(str(DB_PATH), read_only=True) as connection:
        for table, order_by in TABLES.items():
            rows = export_table(connection, table, order_by)
            output_path = OUTPUT_DIR / f"{table}.json"
            write_json(output_path, rows)
            print(f"Wrote {len(rows):,} rows to {output_path}")
        rows = export_query(connection, BIG_MAC_GBP_ANNUAL_QUERY)
        output_path = OUTPUT_DIR / "big_mac_gbp_annual.json"
        write_json(output_path, rows)
        print(f"Wrote {len(rows):,} rows to {output_path}")


if __name__ == "__main__":
    main()
