import axios from "axios";

// ================= CONFIG (NO ENV VERSION) =================
const BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const OWNER_ID = "8663287615";

// ================= MEMORY ORDER STORAGE =================
const orderMap = new Map();

/**
 * DIPANGGIL DARI BOT SAAT CHECKOUT
 */
export function saveOrder(orderId, data) {
  orderMap.set(orderId, data);
  console.log("ORDER SAVED:", orderId, data);
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
    console.log("Telegram Error:", err.message);
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
    console.log("Send File Error:", err.message);
  }
}

// ================= WEBHOOK =================
export default async function handler(req, res) {
  console.log("WEBHOOK HIT:", req.method, req.body);

  // ONLY POST
  if (req.method !== "POST") {
    return res.status(200).json({
      sukses: false,
      pesan: "Hanya POST",
      method: req.method
    });
  }

  try {
    const { order_id, status, amount } = req.body;

    if (!order_id) {
      return res.status(400).json({
        sukses: false,
        pesan: "order_id wajib"
      });
    }

    const data = orderMap.get(order_id);

    // ================= PAID =================
    if (status === "PAID") {
      console.log("PAID DETECTED:", order_id);

      // kalau user ketemu
      if (data) {
        await sendMessage(
          data.chatId,
          `✅ <b>PAYMENT SUCCESS</b>\n\n` +
          `📦 Produk: ${data.product.title}\n` +
          `🧾 Order: ${order_id}\n` +
          `💰 Amount: Rp${amount}\n\n` +
          `🚀 Auto delivery sedang diproses...`
        );

        // auto delivery file (optional)
        if (data.product?.fileUrl) {
          await sendFile(
            data.chatId,
            data.product.fileUrl,
            `📦 ${data.product.title}`
          );
        }

        orderMap.delete(order_id);
      }

      // fallback kalau mapping hilang
      else {
        await sendMessage(
          OWNER_ID,
          `⚠️ PAID TAPI USER TIDAK DITEMUKAN\nOrder: ${order_id}`
        );
      }
    }

    // ================= PENDING =================
    else if (status === "PENDING") {
      if (data) {
        await sendMessage(
          data.chatId,
          `⏳ <b>PAYMENT PENDING</b>\n\nOrder: ${order_id}`
        );
      }
    }

    // ================= EXPIRED =================
    else if (status === "EXPIRED") {
      if (data) {
        await sendMessage(
          data.chatId,
          `❌ <b>PAYMENT EXPIRED</b>\n\nOrder: ${order_id}`
        );

        orderMap.delete(order_id);
      }
    }

    // ================= RESPONSE =================
    return res.status(200).json({
      sukses: true,
      pesan: "Webhook processed",
      data: {
        order_id,
        status,
        amount
      }
    });

  } catch (err) {
    console.log("WEBHOOK ERROR:", err.message);

    return res.status(500).json({
      sukses: false,
      pesan: "server error"
    });
  }
            }
