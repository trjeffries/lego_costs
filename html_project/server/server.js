const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const app = express();
const PORT = 3000;

const DB_PATH = path.join(__dirname, "..", "assets", "lego.db");

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, "..", "client")));

// Route to fetch LEGO set data from SQLite
app.get("/data", (req, res) => {
  const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      return res.status(500).json({ error: "Database connection failed" });
    }

    const query = `
      SELECT
        set_number,
        set_name,
        theme_l1 AS theme,
        theme_l2 AS sub_theme,
        pieces,
        released,
        retail_gbp AS uk_cost,
        ppbm_us,
        ppbm_gb,
        ppbm_eu,
        ppsp,
        ppp,
        ppd,
        ppe
      FROM full_data
      ORDER BY released, set_number
    `;

    db.all(query, [], (queryError, rows) => {
      db.close((closeError) => {
        if (queryError) {
          console.error("Error querying LEGO data:", queryError.message);
          return res.status(500).json({ error: "LEGO data query failed" });
        }
        if (closeError) {
          console.error("Error closing database:", closeError.message);
          return res.status(500).json({ error: "Database close failed" });
        }
        res.json(rows);
      });
    });
  });
});

// Catch-all route to serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
