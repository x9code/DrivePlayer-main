const axios = require('axios');

async function testAuth() {
    const API_BASE = 'http://localhost:5000';
    try {
        const regRes = await axios.post(`${API_BASE}/api/auth/register`, {
            username: 'test_user_' + Date.now(),
            password: 'password123'
        });
        const token = regRes.data.token;

        const incRes = await axios.post(`${API_BASE}/api/playcounts/test_file_id`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Success!', incRes.data);

    } catch (e) {
        console.log('ERROR JSON:', JSON.stringify(e.response ? e.response.data : e.message, null, 2));
    }
}

testAuth();
