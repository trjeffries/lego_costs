SELECT
    set_name,
    set_number,
    pieces,
    minifigs,
    age,
    theme_l1,
    theme_l2,
    theme_l3,
    brickset,
    released,
    packaging,
    availability,
    COALESCE(retail_gbp, web_gbp) AS retail_gbp,
    COALESCE(web_gbp, retail_gbp) AS web_gbp,
    COALESCE(retail_usd, web_usd) AS retail_usd,
    COALESCE(web_usd, retail_usd) AS web_usd,
    COALESCE(retail_eur, web_gbp) AS retail_eur,
    COALESCE(web_eur, retail_gbp) AS web_eur,
    web_gbp_inf,
    web_eur_inf,
    web_usd_inf

FROM {{ ref('source_lego_sets') }}
