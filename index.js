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
        const { userId, totalAmount, paymentType, items } = req.body;

        // Validasi input
        if (!userId || !totalAmount || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Invalid request data" });
        }

        const orderId = `ORDER-${Date.now()}`;
        
        // Buat payload transaksi dasar
        const transactionDetails = {
            transaction_details: {
                order_id: orderId,
                gross_amount: totalAmount
            },
            item_details: items.map(item => ({
                id: item.id,
                price: item.price,
                quantity: item.quantity,
                name: item.name
            })),
            customer_details: {
                email: `${userId}@email.com`,
                first_name: "User",
                last_name: "Ecommerce"
            }
        };

        // Tambahkan enabled_payments berdasarkan payment_type yang dipilih
        if (paymentType) {
            // Map payment types dari UI ke enabled_payments Midtrans
            const paymentMethodMapping = {
                'credit_card': ['credit_card'],
                'bank_transfer': ['bca_va', 'bni_va', 'bri_va', 'mandiri_va', 'permata_va'],
                'e_wallet': ['gopay', 'shopeepay', 'qris', 'dana'],
                'convenience_store': ['indomaret', 'alfamart']
            };

            const enabledPayments = paymentMethodMapping[paymentType] || [];
            
            if (enabledPayments.length > 0) {
                transactionDetails.enabled_payments = enabledPayments;
            }
        }

        // Request ke Midtrans
        const response = await axios.post(MIDTRANS_API_URL, transactionDetails, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${Buffer.from(MIDTRANS_SERVER_KEY + ":").toString("base64")}`
            }
        });

        res.json({ 
            snap_token: response.data.token, 
            order_id: orderId,
            redirect_url: response.data.redirect_url 
        });
    }
    catch (error) {
        console.error("Midtrans Error:", {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            stack: error.stack, // Tambahkan stack trace untuk debugging
        });
    
        res.status(500).json({ 
            error: "Terjadi kesalahan saat memproses transaksi.",
            message: error.message, // Menampilkan pesan error yang lebih spesifik
            status: error.response?.status || 500, // Status kode error dari Midtrans
            details: error.response?.data || "Tidak ada detail tambahan.",
        });
    }
    
});

// Jalankan server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));