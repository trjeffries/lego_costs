WITH costs_per AS (
    SELECT
        theme_l1,
        theme_l2,
        theme_l3,
        DATE_PART('year',released)::INT AS year,
        pieces/(retail_usd/big_mac_usd) AS ppbm_us,
        pieces/(retail_gbp/big_mac_gbp) AS ppbm_gb,
        pieces/(retail_eur/big_mac_eur) AS ppbm_eu,
        pieces/(retail_usd/sp500) AS ppsp,
        pieces/retail_gbp AS ppp,
        pieces/retail_usd AS ppd,
        pieces/retail_eur AS ppe
    FROM {{ ref('int_lego__sp500_join') }}
)

SELECT
    year,
    MEDIAN(ppbm_us) AS ppbm_us,
    MEDIAN(ppbm_gb) AS ppbm_gb,
    MEDIAN(ppbm_eu) AS ppbm_eu,
    MEDIAN(ppsp) AS ppsp,
    MEDIAN(ppp) AS ppp,
    MEDIAN(ppd) AS ppd,
    MEDIAN(ppe) AS ppe
FROM costs_per
GROUP BY ALL
