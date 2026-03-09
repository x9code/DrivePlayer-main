require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

const mailOptions = {
    from: `"DrivePlayer" <${process.env.SMTP_USER}>`,
    to: "driveplayer.info@gmail.com",
    subject: 'Test Verification Code',
    text: `Your verification code is: 123456.`,
};

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error("Test Email error:", error.message);
    } else {
        console.log("Test Email sent successfully:", info.response);
    }
});
