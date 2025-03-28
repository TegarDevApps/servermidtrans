require("dotenv").config(); // Load .env file

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

// Konfigurasi CORS dengan opsi yang lebih spesifik
app.use(cors({
    origin: true, // Mengizinkan semua origin
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

// Middleware untuk parsing JSON
app.use(express.json());

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
    console.log("Incoming Transaction Request:", {
        body: req.body,
        headers: req.headers
    });

    try {
        const { userId, totalAmount, paymentType, items } = req.body;

        // Validasi input yang lebih komprehensif
        if (!userId) {
            return res.status(400).json({ 
                error: "User ID is required",
                details: "Tidak ada user ID yang diberikan"
            });
        }

        // Validasi dan hitung ulang total amount
        const calculatedTotal = items.reduce((sum, item) => 
            sum + (Math.round(item.price) * item.quantity), 0);

        console.log("Received Total Amount:", totalAmount);
        console.log("Calculated Total Amount:", calculatedTotal);

        // Toleransi selisih kecil untuk perhitungan
        const TOLERANCE = 100; // Toleransi 100 rupiah

        // Validasi total amount dengan toleransi
        if (Math.abs(totalAmount - calculatedTotal) > TOLERANCE) {
            console.error("Total amount mismatch", {
                receivedTotal: totalAmount,
                calculatedTotal: calculatedTotal
            });
            return res.status(400).json({ 
                error: "Total amount tidak sesuai dengan item",
                details: `Total diterima: ${totalAmount}, Total dihitung: ${calculatedTotal}`
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ 
                error: "Invalid or empty items list",
                details: "Daftar item kosong atau tidak valid"
            });
        }

        const orderId = `ORDER-${Date.now()}`;
        
        // Payload transaksi
        const transactionDetails = {
            transaction_details: {
                order_id: orderId,
                gross_amount: Math.round(totalAmount)
            },
            item_details: items.map(item => ({
                id: item.id,
                price: Math.round(item.price),
                quantity: item.quantity,
                name: item.name
            })),
            customer_details: {
                email: `${userId}@email.com`,
                first_name: "User",
                last_name: "Ecommerce"
            }
        };

        // Tambahkan enabled_payments
        if (paymentType) {
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
        // Log error secara mendetail
        console.error("Comprehensive Midtrans Error:", {
            name: error.name,
            message: error.message,
            responseStatus: error.response?.status,
            responseData: error.response?.data
        });
    
        // Kirim response error yang informatif
        res.status(500).json({ 
            error: "Terjadi kesalahan saat memproses transaksi",
            details: {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            }
        });
    }
});

// Tambahkan error handler global
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({
        error: "Terjadi kesalahan server",
        details: err.message
    });
});

// Jalankan server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));