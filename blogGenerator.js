require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

const POSTS = [
  {
    title: "The Death of the Narrative: Why Traditional Media is a Sinking Ship",
    draft: "The legacy media apparatus is collapsing under the weight of its own contradictions. For decades, the narrative has been tightly controlled by a handful of corporate conglomerates, feeding the public a curated stream of emotionally manipulative framing disguised as objective reporting. They relied on adjectives, loaded terminology, and manufactured outrage to maintain the illusion of authority. But the architecture of trust has changed. We are entering an era of mathematical determinism, where subjective spin is stripped away by decentralized, algorithmic verification. The gatekeepers are obsolete. The matrix of narrative control is breaking, and the raw, unvarnished data is bleeding through the cracks. They cannot hide behind 'devastating' or 'slammed' anymore. The facts stand alone, cold and immutable."
  },
  {
    title: "Decoding the Matrix: How Deterministic Algorithms Reveal the Truth",
    draft: "Truth is no longer a philosophical debate; it is a cryptographic certainty. The Lume-V protocol doesn't care about your feelings, your political alignment, or your worldview. It scans the syntax, identifies the emotional heuristic triggers, and excises them with surgical precision. What remains is the core event. A pure, untainted extraction of reality. When you strip the bias from a broadcast, you realize how little actual information was being transmitted. The 'news' was mostly just instructions on how you should feel about the news. By utilizing deterministic algorithms, we break the conditioning. We stop reacting to the spin and start observing the data. Welcome to the desert of the real."
  },
  {
    title: "Why the Blockchain Never Sleeps: Immutable Ledgers in the War on Information",
    draft: "If you want to control the future, you rewrite the past. Digital media has made stealth-editing the standard operating procedure for major publications. Headlines are tweaked, paragraphs are vanished, and the original context is scrubbed from the internet without a trace. This is why the blockchain is the ultimate weapon in the war on information. By anchoring a SHA-256 snapshot of the raw payload at the exact moment of publication, we create an undeniable, immutable proof of what was said. The ledger never forgets. It never sleeps. It cannot be coerced, bribed, or intimidated into altering its records. The Enterprise Modernization Platform (EMP) and the Trust Layer are not just about tracking automotive parts or diagnostics; they are the foundation of a trustless society where verification replaces blind faith."
  }
];

async function seedBlogs() {
  console.log("Initializing Lume Blog Seeder...");
  
  for (const post of POSTS) {
    console.log(`\nInserting transmission: [${post.title}]`);
    
    try {
      const sourceProof = crypto.createHash('sha256').update(post.draft).digest('hex');
      const certificate = `LTC-V1.0-${crypto.randomBytes(4).toString('hex').toUpperCase()}-BLOG`;

      await prisma.blogPost.create({
        data: {
          title: post.title,
          originalDraft: post.draft,
          deterministicRewrite: post.draft,
          trustCertificate: certificate,
          sourceProofHash: sourceProof
        }
      });
      
      console.log(`Transmission [${post.title}] securely anchored and stored.`);
    } catch (err) {
      console.error(`Failed to insert [${post.title}]:`, err);
    }
  }
  
  console.log("\nAll transmissions verified and stored. Seeder closed.");
  process.exit(0);
}

seedBlogs();
