require("dotenv").config(); // Load .env file

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const MIDTRANS_API_URL = "https://app.sandbox.midtrans.com/snap/v1/transactions";

// Pastikan kunci API tersedia
if (!MIDTRANS_SERVER_KEY) {
  console.error("MIDTRANS_SERVER_KEY tidak ditemukan! Pastikan ada di .env");
  process.exit(1);
}

// Route untuk cek server berjalan
app.get("/", (req, res) => {
    res.send("Midtrans API is running...");
});

// Route untuk membuat transaksi
app.post("/create-transaction", async (req, res) => {
    try {
        const { userId, totalAmount, items } = req.body;

        // Validasi input
        if (!userId || !totalAmount || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Invalid request data" });
        }

        const transactionDetails = {
            transaction_details: {
                order_id: `ORDER-${Date.now()}`,
                gross_amount: totalAmount
            },
            item_details: items,
            customer_details: {
                email: `${userId}@email.com`,
                first_name: "User",
                last_name: "Ecommerce"
            }
        };

        // Request ke Midtrans
        const response = await axios.post(MIDTRANS_API_URL, transactionDetails, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64")}`
            }
        });

        res.json({ snap_token: response.data.token, order_id: transactionDetails.transaction_details.order_id });
    } catch (error) {
        console.error("Midtrans Error:", error.response?.data || error.message);
        res.status(500).json({ error: "Terjadi kesalahan saat memproses transaksi." });
    }
});

// Jalankan server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
