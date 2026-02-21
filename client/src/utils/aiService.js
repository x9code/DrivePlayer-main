const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
/**
 * AI Service to handle intent detection via Gemini API.
 */
export const aiService = {
    /**
     * Parse user command into structured JSON.
     * @param {string} command - The raw command text (after removing "sound").
     * @returns {Promise<{action: string, keywords: string[]}>}
     */
    async parseCommand(command) {
        if (!GEMINI_API_KEY) {
            console.error("Gemini API Key missing (VITE_GEMINI_API_KEY)");
            return this.fallbackParse(command);
        }

        const prompt = `
            You are an assistant for a music player called SOUND.
            Given the user command, return ONLY a JSON object with:
            "action": one of "play", "pause", "resume", "search", "next", "previous"
            "keywords": an array of strings (names of songs, artists, or genres) if applicable.

            Examples:
            "play sad songs" -> {"action": "search", "keywords": ["sad songs"]}
            "pause" -> {"action": "pause", "keywords": []}
            "next song" -> {"action": "next", "keywords": []}
            "play adele" -> {"action": "search", "keywords": ["adele"]}
            "play someone like you" -> {"action": "search", "keywords": ["someone like you"]}

            Note: "play" usually implies "search" and then playing the best match unless it's just "play" or "resume".

            User Command: "${command}"
        `;

        try {
            console.log(`[SOUND AI] Parsing command: "${command}"`);
            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("[SOUND AI] API Error:", response.status, errData);
                throw new Error(`Gemini API Error: ${response.status}`);
            }

            const data = await response.json();
            const resultText = data.candidates[0].content.parts[0].text;
            console.log("[SOUND AI] Response received:", resultText);
            const result = JSON.parse(resultText);

            return {
                action: result.action || 'search',
                keywords: result.keywords || []
            };
        } catch (error) {
            console.error("[SOUND AI] Failed:", error.message);
            return this.fallbackParse(command);
        }
    },

    /**
     * Fallback parsing logic if AI fails.
     */
    fallbackParse(command) {
        const cmd = command.toLowerCase().trim();
        if (cmd.includes('pause')) return { action: 'pause', keywords: [] };
        if (cmd.includes('resume')) return { action: 'resume', keywords: [] };
        if (cmd.includes('next')) return { action: 'next', keywords: [] };
        if (cmd.includes('previous') || cmd.includes('back')) return { action: 'previous', keywords: [] };
        if (cmd.includes('play')) {
            const keywords = cmd.replace('play', '').trim();
            return { action: 'search', keywords: keywords ? [keywords] : [] };
        }
        if (cmd.includes('search')) {
            const keywords = cmd.replace('search', '').trim();
            return { action: 'search', keywords: keywords ? [keywords] : [] };
        }
        return { action: 'search', keywords: [cmd] };
    }
};
