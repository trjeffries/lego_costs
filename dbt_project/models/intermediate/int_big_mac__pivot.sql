SELECT
    date,
    {{ dbt_utils.pivot(
        'currency_code',
        dbt_utils.get_column_values(ref('source_big_mac'), 'currency_code'),
        then_value='local_price'
    )}}

FROM {{ref('source_big_mac')}}
GROUP BY date
