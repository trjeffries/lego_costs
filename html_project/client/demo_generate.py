import sqlite3
# Define the database name
DATABASE_NAME = "C:\\Users\\thoma\\projects\\my-dashboard\\sales_data.db"
# Connect to SQLite database
conn = sqlite3.connect(DATABASE_NAME)
# Create a cursor object
cursor = conn.cursor()
# SQL to create the 'sales' table
create_table_query = '''
CREATE TABLE IF NOT EXISTS sales (
    order_id INTEGER PRIMARY KEY,
    order_date TEXT,
    customer_id INTEGER,
    customer_name TEXT,
    product_id INTEGER,
    product_names TEXT,
    categories TEXT,
    quantity INTEGER,
    price REAL,
    total REAL
);
'''
# Execute the query to create the table
cursor.execute(create_table_query)
# Sample data to insert into the 'sales' table
sample_data = [
    (1, "2022-08-01", 245, "Customer_884", 201, "Smartphone", "Electronics", 3, 90.02, 270.06),
    (2, "2022-02-19", 701, "Customer_1672", 205, "Printer", "Electronics", 6, 12.74, 76.44),
    (3, "2017-01-01", 184, "Customer_21720", 208, "Notebook", "Stationery", 8, 48.35, 386.80),
    (4, "2013-03-09", 275, "Customer_23770", 200, "Laptop", "Electronics", 3, 74.85, 224.55),
    (5, "2022-04-23", 960, "Customer_23790", 210, "Cabinet", "Office", 6, 53.77, 322.62),
    (6, "2019-07-10", 197, "Customer_25587", 202, "Desk", "Office", 3, 47.17, 141.51),
    (7, "2014-11-12", 510, "Customer_6912", 204, "Monitor", "Electronics", 5, 22.5, 112.5),
    (8, "2016-07-12", 150, "Customer_17761", 200, "Laptop", "Electronics", 9, 49.33, 443.97)
]
# SQL to insert data into the 'sales' table
insert_data_query = '''
INSERT INTO sales (order_id, order_date, customer_id, customer_name, product_id, product_names, categories, quantity, price, total)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
'''
# Insert the sample data
cursor.executemany(insert_data_query, sample_data)
# Commit the transaction
conn.commit()
# Close the connection
conn.close()
print(f"Database '{DATABASE_NAME}' has been created and populated successfully.")