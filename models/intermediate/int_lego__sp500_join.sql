SELECT
    le.*,
    sp.sp500

FROM {{ ref('int_lego__big_mac_join') }} AS le
ASOF LEFT JOIN {{ ref('source_sp500')}} AS sp
    ON le.released >= sp.date