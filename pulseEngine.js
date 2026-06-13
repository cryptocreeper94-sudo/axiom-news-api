// D:\axiom-news-api\pulseEngine.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Pulse Logistic Regression Weights (Calibrated for News Impact)
// These weights simulate the learned coefficients from the ML pipeline.
const PULSE_MODEL_COEFFICIENTS = {
    intercept: -2.5,
    weights: {
        biasScoreNorm: 2.8,       // Highly biased articles have high viral impact
        spinDensity: 1.5,         // Dense spin indicates heavy narrative push
        publisherTrustIndex: -1.2, // Low trust publishers often go more viral for outrage
        categoryWeight: 2.0,      // Specific categories (Politics/Finance) hit harder
        isSatire: -3.0            // Satire rarely has direct market impact
    }
};

// 1. Sigmoid Function
function sigmoid(z) {
    return 1 / (1 + Math.exp(-z));
}

// 2. Predict Probability
function predictProbability(features) {
    let z = PULSE_MODEL_COEFFICIENTS.intercept;
    const { weights } = PULSE_MODEL_COEFFICIENTS;

    z += weights.biasScoreNorm * features.biasScoreNorm;
    z += weights.spinDensity * features.spinDensity;
    z += weights.publisherTrustIndex * features.publisherTrustIndex;
    z += weights.categoryWeight * features.categoryWeight;
    z += weights.isSatire * features.isSatire;

    return sigmoid(z);
}

// 3. Interpret Prediction
function interpretPrediction(probability) {
    if (probability >= 0.70) return 'HIGH';
    if (probability >= 0.40) return 'MEDIUM';
    return 'LOW';
}

// 4. Feature Extraction
async function extractFeatures(deterministicData, rawOriginalText, publisherId) {
    // A. biasScoreNorm (0 to 1)
    const biasScoreNorm = Math.min(Math.max((deterministicData.biasScore || 0) / 100, 0), 1);
    
    // B. spinDensity (0 to 1)
    const totalWords = rawOriginalText ? rawOriginalText.split(/\s+/).length : 1;
    const strippedWords = deterministicData.strippedTerms ? deterministicData.strippedTerms.length : 0;
    const spinDensity = Math.min(strippedWords / Math.max(totalWords, 1), 1);

    // C. publisherTrustIndex (0 to 1)
    // We calculate the historical average bias for this publisher
    const publisherStats = await prisma.article.aggregate({
        where: { publisherId, isSatire: false },
        _avg: { biasScore: true }
    });
    const avgBias = publisherStats._avg.biasScore || 50;
    // Lower average bias = Higher Trust Index
    const publisherTrustIndex = 1 - (Math.min(avgBias, 100) / 100);

    // D. categoryWeight (0 to 1)
    const categoryMapping = {
        'Finance': 1.0,
        'Technology': 0.85,
        'Politics': 0.8,
        'World': 0.4,
        'Science': 0.3
    };
    const categoryWeight = categoryMapping[deterministicData.category] || 0.3;

    // E. isSatire (0 or 1)
    const isSatire = publisherId === 'satire' ? 1 : 0;

    return {
        biasScoreNorm,
        spinDensity,
        publisherTrustIndex,
        categoryWeight,
        isSatire
    };
}

// 5. Main Integration Method
async function generatePrediction(articleId, deterministicData, rawOriginalText, publisherId) {
    try {
        if (deterministicData.isEconomicallyRelevant === false) {
            console.log(`[Pulse] Article ${articleId} flagged as non-economic. Hardcapping probability to 0%.`);
            await prisma.narrativePrediction.create({
                data: { articleId, signal: 'LOW', probability: 0 }
            });
            return { signal: 'LOW', probability: 0 };
        }

        console.log(`[Pulse] Extracting features for Article ${articleId}...`);
        const features = await extractFeatures(deterministicData, rawOriginalText, publisherId);
        
        console.log(`[Pulse] Running Logistic Regression model...`);
        const probability = predictProbability(features);
        const signal = interpretPrediction(probability);
        
        console.log(`[Pulse] Result: ${signal} Impact (Prob: ${(probability*100).toFixed(1)}%)`);

        // Save to DB
        await prisma.narrativePrediction.create({
            data: {
                articleId: articleId,
                signal: signal,
                probability: probability,
                feature: {
                    create: {
                        biasScoreNorm: features.biasScoreNorm,
                        spinDensity: features.spinDensity,
                        publisherTrustIndex: features.publisherTrustIndex,
                        categoryWeight: features.categoryWeight,
                        isSatire: features.isSatire
                    }
                }
            }
        });

        return { signal, probability };
    } catch (error) {
        console.error("[Pulse] Failed to generate prediction:", error.message);
        return null;
    }
}

module.exports = {
    generatePrediction,
    extractFeatures,
    predictProbability,
    interpretPrediction
};
