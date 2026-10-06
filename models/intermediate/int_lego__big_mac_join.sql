SELECT
    le.*,
    bm.USD AS big_mac_usd,
    bm.GBP AS big_mac_gbp,
    bm.EUR AS big_mac_eur

FROM {{ ref('int_lego__prices') }} AS le
ASOF LEFT JOIN {{ ref('int_big_mac__pivot') }} AS bm
    ON le.released >= bm.date