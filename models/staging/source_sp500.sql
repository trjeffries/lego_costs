SELECT
    date,
    ROUND(sp500, 2) AS sp500
FROM {{ source('duckdb', 'sp500_index')}}
