SELECT
    SetName AS set_name,
    Number AS set_number,
    Pieces AS pieces,
    Minifigs AS minifigs,
    AgeMin AS age,
    ThemeGroup AS theme_l1,
    Theme AS theme_l2,
    SubTheme AS theme_l3,
    COALESCE(
        STRPTIME(LaunchDate, '%d/%m/%Y %H:%M:%S')::DATE,
        CONCAT(YearFrom,'-01-01')::DATE)
        AS released,
    PackagingType as packaging,
    CASE
        WHEN CONTAINS(Availability, 'exclusive') THEN 'LEGO exclusive'
        ELSE Availability
        END AS availability,
    UKRetailPrice AS retail_gbp,
    USRetailPrice AS retail_usd,
    DERetailPrice AS retail_eur
    
FROM {{ source('duckdb', 'lego_sets') }}
WHERE Category IN ('Normal', 'Extended', 'Collection')