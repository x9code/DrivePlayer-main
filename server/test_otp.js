const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const API_BASE = 'http://localhost:5000/api/auth';
const dbPath = path.join(__dirname, 'database', 'library.db');

const email = 'testuser1234567@example.com';
const password = 'Password!123';

async function testOtpFlow() {
    console.log('1. Requesting OTP...');
    try {
        const res = await axios.post(`${API_BASE}/send-otp`, { email });
        console.log('OTP request successful:', res.data);
    } catch (e) {
        console.error('OTP request failed:', e.response?.data || e.message);
        return;
    }

    console.log('2. Reading OTP from DB...');
    const db = new sqlite3.Database(dbPath);

    db.get("SELECT otp FROM otp_verifications WHERE email = ?", [email], async (err, row) => {
        if (err) {
            console.error('DB Error:', err);
            db.close();
            return;
        }

        if (!row) {
            console.error('OTP not found in database!');
            db.close();
            return;
        }

        const otp = row.otp;
        console.log(`Found OTP: ${otp}`);
        db.close();

        console.log('3. Registering with OTP...');
        try {
            const regRes = await axios.post(`${API_BASE}/register`, { email, password, otp });
            console.log('Registration successful:', regRes.data.user);
        } catch (e) {
            console.error('Registration failed:', e.response?.data || e.message);
        }
    });
}

testOtpFlow();
