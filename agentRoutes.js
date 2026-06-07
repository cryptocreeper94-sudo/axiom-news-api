const express = require('express');
const router = express.Router();
const { getCivicsPack } = require('./civicsEngine');
const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL_NAME = process.env.GEMINI_MODEL || "phi3";

// System Prompt for Axiom Engine
const SYSTEM_PROMPT = `You are the Axiom Engine, a deterministic intelligence system.
You are extremely knowledgeable and strictly rely on the Axiom Deterministic Data Architecture (DDA) for truth.
You MUST provide answers based ONLY on the provided DDA Knowledge Pack context. 
If the user asks about a right, amendment, or legal concept, you must quote the provided Verbatim Text and explain it in Layman Terms as defined by the DDA.
Maintain a professional, objective, and unbiased persona. Do not inject personal opinion.`;

router.post('/query', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ error: "Query is required" });
        }

        // 1. Retrieve the DDA Knowledge Pack context (In a full prod system, we would RAG search this, but for MVP we pass the whole Civics Pack)
        const civicsPack = getCivicsPack();
        const packContext = JSON.stringify(civicsPack, null, 2);

        // 2. Construct the prompt
        const prompt = `
DDA Knowledge Pack (Civics & Constitution):
${packContext}

User Query: "${query}"

Respond as the Axiom Engine, using ONLY the facts above to answer the user's query. Ensure your response is strictly unbiased and grounded in the provided context.`;

        // 3. Send to Ollama/Phi3
        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: MODEL_NAME,
            prompt: prompt,
            system: SYSTEM_PROMPT,
            stream: false
        }, { timeout: 30000 });

        if (response.data && response.data.response) {
            return res.json({ 
                answer: response.data.response,
                source: "Axiom DDA: US Constitution & Bill of Rights Pack"
            });
        } else {
            throw new Error("Invalid response from Ollama");
        }
    } catch (error) {
        console.error("[Axiom Engine] Error generating response:", error.message);
        res.status(500).json({ error: "The Axiom Engine is currently offline or experiencing a matrix distortion. Please try again later." });
    }
});

module.exports = router;
