import axios from "axios";

// ================= CONFIG =================
const BOT_TOKEN = process.env.BOT_TOKEN;

/**
 * MEMORY STORAGE (PRODUCTION NOTE)
 * - Ini in-memory (Map)
 * - Kalau restart Vercel akan reset
 * - Untuk production serius → ganti MongoDB / Redis
 */
const orderMap = new Map();

/**
 * dipanggil dari bot saat checkout
 * saveOrder(orderId, { chatId, product })
 */
export function saveOrder(orderId, data) {
  orderMap.set(orderId, data);
}

// ================= TELEGRAM HELPERS =================
async function sendMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.log("Telegram send error:", err.message);
  }
}

async function sendFile(chatId, fileUrl, caption = "") {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      chat_id: chatId,
      document: fileUrl,
      caption
    });
  } catch (err) {
    console.log("Send file error:", err.message);
  }
}

// ================= WEBHOOK HANDLER =================
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({
      success: false,
      message: "Only POST allowed"
    });
  }

  try {
    const body = req.body;

    const orderId = body?.order_id;
    const status = body?.status;
    const amount = body?.amount || 0;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "order_id missing"
      });
    }

    // ================= FIND ORDER =================
    const orderData = orderMap.get(orderId);

    // ================= PAID =================
    if (status === "PAID") {
      if (orderData) {
        await sendMessage(
          orderData.chatId,
          `✅ <b>PAYMENT SUCCESS</b>\n\n` +
          `📦 Produk: ${orderData.product.title}\n` +
          `🧾 Order: ${orderId}\n` +
          `💰 Amount: Rp${amount}\n\n` +
          `🚀 Auto delivery sedang diproses...`
        );

        // ================= AUTO DELIVERY =================
        if (orderData.product?.fileUrl) {
          await sendFile(
            orderData.chatId,
            orderData.product.fileUrl,
            `📦 Produk kamu: ${orderData.product.title}`
          );
        } else {
          await sendMessage(
            orderData.chatId,
            `📦 Produk aktif!\nSilakan cek fitur yang kamu beli.`
          );
        }

        // cleanup
        orderMap.delete(orderId);
      } else {
        // fallback jika data tidak ditemukan
        await sendMessage(
          process.env.OWNER_ID,
          `⚠️ PAYMENT PAID tapi order tidak ditemukan:\n${orderId}`
        );
      }
    }

    // ================= PENDING =================
    else if (status === "PENDING") {
      if (orderData) {
        await sendMessage(
          orderData.chatId,
          `⏳ <b>PAYMENT PENDING</b>\n\nOrder: ${orderId}\nSilakan selesaikan pembayaran.`
        );
      }
    }

    // ================= EXPIRED =================
    else if (status === "EXPIRED") {
      if (orderData) {
        await sendMessage(
          orderData.chatId,
          `❌ <b>PAYMENT EXPIRED</b>\n\nOrder: ${orderId}\nSilakan buat transaksi ulang.`
        );

        orderMap.delete(orderId);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Webhook processed"
    });

  } catch (err) {
    console.log("Webhook Error:", err.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}
