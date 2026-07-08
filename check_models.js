require('dotenv').config();

async function listModels() {
    const API_KEY = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("CÁC MODEL BẠN CÓ THỂ DÙNG:");
        data.models.forEach(m => console.log(m.name));
    } catch (err) {
        console.error("Lỗi:", err);
    }
}
listModels();