const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();
let mempool = [];

const mineFractalBlock = async () => {
  if (mempool.length === 0) return;
  console.log(`[Fractal Engine] Mining block with ${mempool.length} transactions...`);
  
  // 1. Calculate Merkle Root
  const hash = crypto.createHash('sha256');
  mempool.forEach(tx => hash.update(JSON.stringify(tx)));
  const merkleRoot = hash.digest('hex');

  // 2. Anchor to Layer 1 (TLL)
  try {
    const payload = {
      facilityId: "AXIOM-L2-NODE",
      ruleId: "FRACTAL-ANCHOR",
      ruleName: "Layer 2 State Commit",
      action: "Anchor Merkle Root",
      outcome: "PASS",
      details: { rootHash: merkleRoot, txCount: mempool.length }
    };
    
    // In production this connects to DWTL Core, for local dev it's 5200
    const response = await fetch('http://localhost:5200/api/submit/governance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => ({ ok: false })); 
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.certificate) {
        console.log(`[Fractal Engine] Anchored to TLL. Payload Hash: ${data.certificate.payloadHash}`);
        
        // 3. Save block & update transactions
        const tllHash = data.certificate.payloadHash;
        const tllSig = data.certificate.signature;
        
        await prisma.fractalBlock.create({
          data: {
            merkleRoot,
            tllAnchorHash: tllHash,
            tllSignature: tllSig
          }
        });

        // Update all intel rows in mempool
        const intelIds = [...new Set(mempool.filter(tx => tx.intelId).map(tx => tx.intelId))];
        if (intelIds.length > 0) {
          await prisma.localIntel.updateMany({
            where: { id: { in: intelIds } },
            data: {
              fractalBlockHash: merkleRoot,
              tllAnchorHash: tllHash,
              tllSignature: tllSig
            }
          });
        }
        
        // Update all notary rows in mempool
        const notaryIds = [...new Set(mempool.filter(tx => tx.notaryId).map(tx => tx.notaryId))];
        if (notaryIds.length > 0) {
          await prisma.notaryRecord.updateMany({
            where: { id: { in: notaryIds } },
            data: {
              fractalBlockHash: merkleRoot,
              tllAnchorHash: tllHash,
              tllSignature: tllSig
            }
          });
        }
      }
    } else {
       console.log(`[Fractal Engine] Local Trust Layer not reachable. Creating offline anchor...`);
       const mockTllHash = "mock_" + crypto.randomBytes(16).toString('hex');
       const mockTllSig = "ed25519_mock_" + crypto.randomBytes(32).toString('hex');
       
       await prisma.fractalBlock.create({
          data: { merkleRoot, tllAnchorHash: mockTllHash, tllSignature: mockTllSig }
       });

       const intelIds = [...new Set(mempool.filter(tx => tx.intelId).map(tx => tx.intelId))];
       if (intelIds.length > 0) {
          await prisma.localIntel.updateMany({
            where: { id: { in: intelIds } },
            data: { fractalBlockHash: merkleRoot, tllAnchorHash: mockTllHash, tllSignature: mockTllSig }
          });
       }
    }
  } catch (e) {
    console.error("[Fractal Engine] TLL Anchor Failed:", e.message);
  }
  
  // Clear mempool
  mempool = [];
};

const startDaemon = () => {
  setInterval(mineFractalBlock, 15000);
  console.log("[Fractal Engine] Daemon started. Mining every 15s.");
};

const submitIntel = async (req, res) => {
  const { zipCode, content } = req.body;
  if (!zipCode || !content) return res.status(400).json({ error: 'Missing data' });

  try {
    const intel = await prisma.localIntel.create({
      data: { zipCode, content }
    });
    mempool.push({ type: 'SUBMIT', intelId: intel.id, zipCode, content });
    res.json({ success: true, id: intel.id });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
};

const voteIntel = async (req, res) => {
  const { id } = req.params;
  const { type } = req.body; 
  const intelId = parseInt(id.replace('intel-', ''), 10);
  
  if (isNaN(intelId)) return res.status(400).json({ error: 'Invalid ID' });
  
  try {
    if(type === 'upvote') {
      await prisma.localIntel.update({
        where: { id: intelId },
        data: { upvotes: { increment: 1 } }
      });
    } else if (type === 'downvote') {
      await prisma.localIntel.update({
        where: { id: intelId },
        data: { downvotes: { increment: 1 } }
      });
    } else {
      throw new Error('Invalid vote type');
    }
    
    mempool.push({ type: 'VOTE', action: type, intelId });
    res.json({ success: true });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
};

const submitNotary = async (req, res) => {
  const { clientHash } = req.body;
  if (!clientHash) return res.status(400).json({ error: 'Missing hash' });
  
  try {
    const notary = await prisma.notaryRecord.create({
      data: { clientHash }
    });
    mempool.push({ type: 'NOTARY', notaryId: notary.id, clientHash });
    res.json({ success: true, id: notary.id });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
};

const getNotary = async (req, res) => {
  try {
    const notaryId = parseInt(req.params.id, 10);
    if (isNaN(notaryId)) return res.status(400).json({ error: 'Invalid ID' });
    
    const notary = await prisma.notaryRecord.findUnique({ where: { id: notaryId } });
    if (!notary) return res.status(404).json({ error: 'Not found' });
    res.json(notary);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
};

module.exports = {
  startDaemon,
  submitIntel,
  voteIntel,
  submitNotary,
  getNotary
};
