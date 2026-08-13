// AI Judge + Jail/Bond. Feeds an arrest report (charges, prior record, evidence)
// to Gemini for a fair, legally-plausible verdict + sentence + parole. Verdicts
// start as "pending" (a recommendation); a human judge LOCKS them to make them
// final. On lock, the bond is charged from the subject's linked economy wallet —
// if they can't afford it, the case is flagged REPO-eligible.
import { getDb } from '../db/index.js';
import { allLinks } from './roblox.js';
import { balance, withdraw } from '../economy/store.js';

const KEY = () => process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS cad_verdicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, subject TEXT, charges TEXT,
  jail INTEGER DEFAULT 0, fine INTEGER DEFAULT 0, bond INTEGER DEFAULT 0, evidence TEXT,
  verdict TEXT, sentence TEXT, parole TEXT, reasoning TEXT, ai INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending', judge TEXT, bond_paid INTEGER DEFAULT 0, repo INTEGER DEFAULT 0, created_at INTEGER
)`);
const q = {
  add: db.prepare('INSERT INTO cad_verdicts(guild_id,subject,charges,jail,fine,bond,evidence,verdict,sentence,parole,reasoning,ai,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'),
  list: db.prepare('SELECT * FROM cad_verdicts WHERE guild_id=? ORDER BY id DESC LIMIT 50'),
  get: db.prepare('SELECT * FROM cad_verdicts WHERE id=? AND guild_id=?'),
  lock: db.prepare("UPDATE cad_verdicts SET status='locked', judge=?, bond_paid=?, repo=? WHERE id=? AND guild_id=?"),
};

// Ask Gemini for a verdict. Returns { verdict, sentence, fine, bond, parole, reasoning } or { error }.
export async function aiVerdict(caseData) {
  if (!KEY()) return { error: 'AI not configured (GEMINI_API_KEY missing).' };
  const sys = 'You are an impartial municipal court judge for a Roblox police roleplay game (ER:LC / Liberty County). Given an arrest report, produce a FAIR, legally-plausible verdict. This is fiction for a game — keep sentences reasonable (minutes, not years) and non-graphic. Respond ONLY as strict minified JSON with these keys: {"verdict":"Guilty|Not Guilty|Plea Deal","sentence":"e.g. 25 minutes jail","fine":<number>,"bond":<number>,"parole":"short condition or None","reasoning":"1-2 sentences"}.';
  const prompt = `Subject: ${caseData.subject || 'Unknown'}\nCharges: ${caseData.charges || 'n/a'}\nRequested jail (min): ${caseData.jail || 0}\nRequested fine ($): ${caseData.fine || 0}\nPrior record: ${caseData.prior || 'none on file'}\nEvidence: ${caseData.evidence || 'none'}\nNarrative: ${caseData.narrative || 'none'}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY() },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024, responseMimeType: 'application/json' },
      }),
    });
    const data = await r.json();
    if (data?.error) return { error: data.error.message || 'AI error' };
    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join('').trim();
    try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch { return { error: 'AI returned an unparseable verdict.', raw: text.slice(0, 300), finish: data?.candidates?.[0]?.finishReason }; }
  } catch (e) { return { error: 'AI request failed: ' + e.message }; }
}

export function saveVerdict(g, v) {
  return Number(q.add.run(g, (v.subject || '').slice(0, 60), (v.charges || '').slice(0, 300), Math.max(0, +v.jail || 0), Math.max(0, +v.fine || 0), Math.max(0, +v.bond || 0), (v.evidence || '').slice(0, 500), (v.verdict || '').slice(0, 40), (v.sentence || '').slice(0, 120), (v.parole || '').slice(0, 200), (v.reasoning || '').slice(0, 400), v.ai ? 1 : 0, Date.now()).lastInsertRowid);
}
export function listVerdicts(g) { return q.list.all(g); }
export function getVerdict(g, id) { return q.get.get(id, g); }

// Lock a verdict (judge makes it final) → charge bond from the subject's linked
// economy wallet; if unaffordable, mark the case REPO-eligible. Returns details so
// the route can flag the subject's vehicles too.
export function lockVerdict(g, id, judgeName) {
  const v = q.get.get(id, g);
  if (!v) return { error: 'Verdict not found.' };
  let bondPaid = 0; let repo = 0;
  if (v.bond > 0) {
    const link = (allLinks(g) || []).find((l) => String(l.roblox_name || '').toLowerCase() === String(v.subject || '').toLowerCase());
    if (link?.user_id) {
      try { if (balance(link.user_id) >= v.bond) { withdraw(link.user_id, v.bond); bondPaid = 1; } else { repo = 1; } }
      catch { /* economy unavailable */ }
    }
  }
  q.lock.run(judgeName || 'Judge', bondPaid, repo, id, g);
  return { ok: true, subject: v.subject, bond: v.bond, bondPaid: !!bondPaid, repo: !!repo };
}
