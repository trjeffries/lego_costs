SELECT
    date,
    currency_code,
    local_price

FROM {{ source('duckdb','big_mac_adjusted') }}
WHERE currency_code IN ('EUR', 'GBP','USD')
