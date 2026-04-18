// src/templates/resetPassword.template.ts

type ResetTemplateProps = {
  otp: string;
  name?: string;
  appName?: string;
  expiryMinutes?: number;
};

export const resetPasswordTemplate = ({
  otp,
  name = "User",
  appName = "Your App",
  expiryMinutes = 1,
}: ResetTemplateProps): string => {
  const currentYear = new Date().getFullYear();

  // Centralized styles (avoid repetition)
  const styles = {
    body: "margin:0;padding:0;background:#f4f6f8;font-family:Inter,Arial,sans-serif;",
    card: "background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,0.08);",
    header: "background:linear-gradient(135deg,#667eea,#764ba2);padding:28px;text-align:center;color:#fff;",
    content: "padding:28px;color:#333;",
    otpBox: `
      display:inline-block;
      padding:14px 24px;
      font-size:26px;
      letter-spacing:5px;
      font-weight:bold;
      color:#333;
      background:#f1f3f5;
      border-radius:8px;
    `,
    footer: "background:#fafafa;padding:18px;text-align:center;font-size:12px;color:#aaa;",
    textMuted: "font-size:13px;color:#888;text-align:center;",
  };

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>

    <body style="${styles.body}">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;">
        <tr>
          <td align="center">

            <!-- Card -->
            <table width="100%" style="max-width:500px;${styles.card}">
              
              <!-- Header -->
              <tr>
                <td style="${styles.header}">
                  <h1 style="margin:0;font-size:22px;">🔐 Reset Your Password</h1>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="${styles.content}">
                  
                  <p style="margin:0 0 10px;font-size:15px;">
                    Hi ${name},
                  </p>

                  <p style="margin:0 0 15px;font-size:14px;color:#555;">
                    We received a request to reset your password. Use the OTP below:
                  </p>

                  <!-- OTP -->
                  <div style="margin:25px 0;text-align:center;">
                    <span style="${styles.otpBox}">
                      ${otp}
                    </span>
                  </div>

                  <p style="${styles.textMuted}">
                    ⏱ Valid for ${expiryMinutes} hour
                  </p>

                  <hr style="border:none;border-top:1px solid #eee;margin:25px 0;" />

                  <p style="font-size:12px;color:#999;text-align:center;">
                    If you didn’t request this, please ignore this email.
                  </p>

                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="${styles.footer}">
                  © ${currentYear} ${appName}. All rights reserved.
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
};