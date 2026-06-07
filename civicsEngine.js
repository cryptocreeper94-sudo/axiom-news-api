const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Deterministic Knowledge Pack: US Constitution & Bill of Rights
const CIVICS_PACK = {
    "First Amendment": {
        verbatimText: "Congress shall make no law respecting an establishment of religion, or prohibiting the free exercise thereof; or abridging the freedom of speech, or of the press; or the right of the people peaceably to assemble, and to petition the Government for a redress of grievances.",
        laymanTerms: "The government cannot create a national religion, stop you from practicing your religion, or punish you for expressing your opinions. It also guarantees a free press, the right to protest peacefully, and the right to ask the government to fix problems.",
        keywords: ["speech", "censorship", "protest", "religion", "press", "assembly", "petition", "ban", "boycott"]
    },
    "Second Amendment": {
        verbatimText: "A well regulated Militia, being necessary to the security of a free State, the right of the people to keep and bear Arms, shall not be infringed.",
        laymanTerms: "The government cannot infringe upon an individual's right to own and carry weapons.",
        keywords: ["gun", "firearm", "weapons", "carry", "arms", "shooting", "ban", "rifle", "pistol"]
    },
    "Fourth Amendment": {
        verbatimText: "The right of the people to be secure in their persons, houses, papers, and effects, against unreasonable searches and seizures, shall not be violated, and no Warrants shall issue, but upon probable cause, supported by Oath or affirmation, and particularly describing the place to be searched, and the persons or things to be seized.",
        laymanTerms: "The government and police cannot search your body, home, or belongings without a good reason (probable cause) and a specific warrant signed by a judge.",
        keywords: ["search", "seizure", "warrant", "police", "privacy", "surveillance", "wiretap", "raid"]
    },
    "Fifth Amendment": {
        verbatimText: "No person shall be held to answer for a capital, or otherwise infamous crime, unless on a presentment or indictment of a Grand Jury... nor shall any person be subject for the same offence to be twice put in jeopardy of life or limb; nor shall be compelled in any criminal case to be a witness against himself, nor be deprived of life, liberty, or property, without due process of law; nor shall private property be taken for public use, without just compensation.",
        laymanTerms: "You have the right to remain silent, you cannot be tried for the same crime twice, you must receive fair legal proceedings (due process), and the government must pay you if they take your property.",
        keywords: ["silent", "double jeopardy", "due process", "plead the fifth", "eminent domain", "interrogation", "self-incrimination"]
    },
    "Sixth Amendment": {
        verbatimText: "In all criminal prosecutions, the accused shall enjoy the right to a speedy and public trial, by an impartial jury of the State and district wherein the crime shall have been committed... and to have the Assistance of Counsel for his defence.",
        laymanTerms: "If accused of a crime, you have the right to a fast, public trial by an unbiased jury, the right to know your accusers, and the right to a lawyer.",
        keywords: ["trial", "jury", "lawyer", "attorney", "court", "counsel", "speedy trial", "cross-examine"]
    },
    "Eighth Amendment": {
        verbatimText: "Excessive bail shall not be required, nor excessive fines imposed, nor cruel and unusual punishments inflicted.",
        laymanTerms: "The government cannot set unreasonably high bail or fines, and they cannot use cruel or unusual punishments.",
        keywords: ["bail", "fines", "cruel", "punishment", "death penalty", "torture"]
    },
    "Tenth Amendment": {
        verbatimText: "The powers not delegated to the United States by the Constitution, nor prohibited by it to the States, are reserved to the States respectively, or to the people.",
        laymanTerms: "Any power not explicitly given to the federal government belongs to the states or to the people.",
        keywords: ["state rights", "federalism", "federal government", "local control", "states"]
    },
    "Fourteenth Amendment": {
        verbatimText: "All persons born or naturalized in the United States, and subject to the jurisdiction thereof, are citizens of the United States and of the State wherein they reside. No State shall make or enforce any law which shall abridge the privileges or immunities of citizens of the United States; nor shall any State deprive any person of life, liberty, or property, without due process of law; nor deny to any person within its jurisdiction the equal protection of the laws.",
        laymanTerms: "Anyone born or naturalized in the US is a citizen. States cannot violate constitutional rights, must provide due process, and must treat everyone equally under the law.",
        keywords: ["citizenship", "equal protection", "discrimination", "civil rights", "due process", "14th"]
    }
};

/**
 * Deterministically analyzes text to find Constitutional relevance based on keywords.
 * (A fully deterministic, non-LLM fallback method)
 */
function determineCivicsContext(text) {
    if (!text) return null;
    const lowerText = text.toLowerCase();
    
    // Find the amendment with the most keyword hits
    let bestMatch = null;
    let highestHits = 0;

    for (const [amendment, data] of Object.entries(CIVICS_PACK)) {
        let hits = 0;
        for (const keyword of data.keywords) {
            // Very simple deterministic word boundary check
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const matches = lowerText.match(regex);
            if (matches) {
                hits += matches.length;
            }
        }
        
        if (hits > highestHits) {
            highestHits = hits;
            bestMatch = amendment;
        }
    }

    // Require at least 2 keyword hits to trigger a context insertion to avoid noise
    if (highestHits >= 2 && bestMatch) {
        return {
            amendment: bestMatch,
            verbatimText: CIVICS_PACK[bestMatch].verbatimText,
            laymanTerms: CIVICS_PACK[bestMatch].laymanTerms
        };
    }

    return null;
}

/**
 * Main pipeline integration method
 */
async function extractAndSaveCivicsContext(articleId, rawText) {
    try {
        const context = determineCivicsContext(rawText);
        if (context) {
            console.log(`[CivicsEngine] Detected Constitutional context for Article ${articleId}: ${context.amendment}`);
            await prisma.constitutionalContext.create({
                data: {
                    articleId: articleId,
                    amendment: context.amendment,
                    verbatimText: context.verbatimText,
                    laymanTerms: context.laymanTerms,
                    relevance: `Deterministic analysis flagged ${context.amendment} relevance.`
                }
            });
            return context;
        }
        return null;
    } catch (error) {
        console.error("[CivicsEngine] Failed to save context:", error.message);
        return null;
    }
}

// Function to serve the raw pack to the Agent
function getCivicsPack() {
    return CIVICS_PACK;
}

module.exports = {
    extractAndSaveCivicsContext,
    determineCivicsContext,
    getCivicsPack
};
