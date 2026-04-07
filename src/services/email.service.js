// backend/src/services/email.service.js

import nodemailer from 'nodemailer';

// ❌ Pehle aisa tha — module load pe ban jaata tha, .env se pehle
// const transporter = nodemailer.createTransport({ ... });

// ✅ Ab function ke andar banao — jab actually call ho tab env read ho
const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_FROM,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendNewOrderEmail = async ({
  orderNumber, orderType, customerName, customerPhone,
  customerAddress, items, total, specialInstructions
}) => {
  try {
    // Debug log — confirm karo values aa rahi hain
    console.log('📧 EMAIL_FROM:', process.env.EMAIL_FROM);
    console.log('📧 EMAIL_PASS loaded:', !!process.env.EMAIL_PASS);

    const orderTypeConfig = {
      delivery:       { emoji: '🛵', label: 'Delivery'     },
      takeaway:       { emoji: '🥡', label: 'Takeaway'     },
      'room-service': { emoji: '🛎️', label: 'Room Service' },
      'dine-in':      { emoji: '🍽️', label: 'Dine-in'      },
    };
    const config = orderTypeConfig[orderType] || { emoji: '🆕', label: orderType };

    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;">
          ${item.name}${item.variant ? ` (${item.variant})` : ''}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;">
          ${item.quantity}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">
          ₹${item.price * item.quantity}
        </td>
      </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <div style="background:#0d9488;padding:28px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;">
            ${config.emoji} New ${config.label} Order!
          </h1>
          <p style="margin:6px 0 0;color:#99f6e4;font-size:14px;">Order #${orderNumber}</p>
        </div>
        <div style="padding:24px 32px;border-bottom:1px solid #f0f0f0;">
          <h2 style="margin:0 0 16px;font-size:16px;color:#374151;">👤 Customer Details</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:4px 0;color:#6b7280;font-size:14px;width:120px;">Name</td>
              <td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${customerName}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#6b7280;font-size:14px;">Phone</td>
              <td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${customerPhone}</td>
            </tr>
            ${orderType === 'delivery' && customerAddress ? `
            <tr>
              <td style="padding:4px 0;color:#6b7280;font-size:14px;vertical-align:top;">Address</td>
              <td style="padding:4px 0;color:#111827;font-size:14px;font-weight:600;">${customerAddress}</td>
            </tr>` : ''}
          </table>
        </div>
        <div style="padding:24px 32px;border-bottom:1px solid #f0f0f0;">
          <h2 style="margin:0 0 16px;font-size:16px;color:#374151;">🧾 Order Items</h2>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-size:13px;color:#6b7280;font-weight:600;">Item</th>
                <th style="padding:8px 12px;text-align:center;font-size:13px;color:#6b7280;font-weight:600;">Qty</th>
                <th style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280;font-weight:600;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>
        <div style="padding:24px 32px;">
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;padding:16px 20px;border-radius:8px;margin-bottom:16px;">
            <span style="font-size:16px;font-weight:600;color:#374151;">Total Amount</span>
            <span style="font-size:20px;font-weight:700;color:#0d9488;">₹${total}</span>
          </div>
          ${specialInstructions ? `
          <div style="background:#fffbeb;padding:14px 18px;border-radius:8px;border-left:3px solid #f59e0b;">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">📝 Special Instructions</p>
            <p style="margin:6px 0 0;font-size:14px;color:#78350f;">${specialInstructions}</p>
          </div>` : ''}
        </div>
        <div style="background:#f9fafb;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            FusionPOS • Order received at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </p>
        </div>
      </div>
    </body>
    </html>`;

    // ✅ Yahan getTransporter() call hoga — env already load ho chuki hogi
    await getTransporter().sendMail({
      from: `"FusionPOS Orders" <${process.env.EMAIL_FROM}>`,
      to: process.env.EMAIL_TO,
      subject: `${config.emoji} New ${config.label} Order #${orderNumber} — ₹${total}`,
      html,
    });

    console.log('📧 Order email sent for:', orderNumber);
  } catch (err) {
    console.error('📧 Email send error (non-critical):', err.message);
  }
};