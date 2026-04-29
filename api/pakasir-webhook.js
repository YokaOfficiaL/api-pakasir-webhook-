import axios from "axios";

// ================= HARD CODE CONFIG =================
const BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const OWNER_ID = "8663287615";

// ================= ORDER MAP =================
const orderMap = new Map();

/**
 * dipanggil dari bot saat checkout
 */
export function saveOrder(orderId, data) {
  orderMap.set(orderId, data);
}

// ================= TELEGRAM =================
async function sendMessage(chatId, text) {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });
  } catch (err) {
    console.log("Telegram error:", err.message);
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
    console.log("File error:", err.message);
  }
}

// ================= WEBHOOK =================
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({
      success: false,
      message: "POST only"
    });
  }

  try {
    const { order_id, status, amount } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "order_id required"
      });
    }

    const data = orderMap.get(order_id);

    // ================= PAID =================
    if (status === "PAID") {
      if (data) {
        await sendMessage(
          data.chatId,
          `✅ <b>PAYMENT SUCCESS</b>\n\n` +
          `📦 Produk: ${data.product.title}\n` +
          `🧾 Order: ${order_id}\n` +
          `💰 Amount: Rp${amount}\n\n` +
          `🚀 Auto delivery aktif`
        );

        if (data.product?.fileUrl) {
          await sendFile(
            data.chatId,
            data.product.fileUrl,
            "📦 File Produk"
          );
        }

        orderMap.delete(order_id);
      }
    }

    // ================= PENDING =================
    else if (status === "PENDING") {
      if (data) {
        await sendMessage(
          data.chatId,
          `⏳ Payment Pending\nOrder: ${order_id}`
        );
      }
    }

    // ================= EXPIRED =================
    else if (status === "EXPIRED") {
      if (data) {
        await sendMessage(
          data.chatId,
          `❌ Payment Expired\nOrder: ${order_id}`
        );

        orderMap.delete(order_id);
      }
    }

    return res.status(200).json({
      success: true,
      message: "OK"
    });

  } catch (err) {
    console.log("Webhook Error:", err.message);

    return res.status(500).json({
      success: false,
      message: "error"
    });
  }
}
