SELECT
    "set name" AS set_name,
    "set number" AS set_number,
    pieces,
    "minifig count" AS minifigs,
    "minimum age" AS age,
    "theme group" AS theme_l1,
    theme AS theme_l2,
    "sub-theme" AS theme_l3,
    "brickset url" AS brickset,
    COALESCE(
        STRPTIME("date released", '%d/%m/%Y')::DATE,
        CONCAT(year,'-01-01')::DATE)
        AS released,
    packaging,
    availability,
    "uk retail price" AS retail_gbp,
    "us retail price" AS retail_usd,
    "de retail price" AS retail_eur,
    "web gbp price" AS web_gbp,
    "web usd price" AS web_usd,
    "web eur price" AS web_eur,
    "web gbp price (inflated)" AS web_gbp_inf,
    "web usd price (inflated)" AS web_usd_inf,
    "web eur price (inflated)" AS web_eur_inf

FROM {{ source('duckdb', 'lego_sets') }}
