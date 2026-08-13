// Report Center — a data-driven incident-report engine. One catalog of 60+ report
// types across 8 divisions (each with its own field schema), one generic form
// generator on the client, and per-report Save / Download / Print. Rather than
// hand-authoring 60 bespoke pages, every report is defined by a compact field
// list here and rendered by the same engine — real, maintainable, not filler.
import { getDb } from '../db/index.js';

// field helpers: T text · N number · A textarea · C checkbox · D date · O select(options)
const T = (l) => [l, 'text'];
const N = (l) => [l, 'num'];
const A = (l) => [l, 'area'];
const C = (l) => [l, 'chk'];
const D = (l) => [l, 'date'];
const O = (l, ...o) => [l, 'opt', o];

const CATALOG = [
  { cat: '🚦 Traffic & Highway Patrol', reports: [
    { id: 'refuse-sign', title: 'Refusal to Sign Citation', f: [T('Citation #'), O('Refusal type', 'Verbal', 'Physical'), T('Witness')] },
    { id: 'dot-inspect', title: 'Commercial Vehicle Inspection (DOT)', f: [N('Weight (lbs)'), A('Cargo manifest'), N('Logbook hours'), C('Over tolerance')] },
    { id: 'dui-worksheet', title: 'DUI / Physical Sobriety Worksheet', f: [N('BAC'), T('HGN result'), A('Walk-and-turn'), T('Breathalyzer #')] },
    { id: 'stolen-recovered', title: 'Stolen / Recovered Vehicle Checklist', f: [T('Plate'), C('Ignition damage'), A('Missing parts'), T('Tracking data')] },
    { id: 'pursuit', title: 'Evading Arrest / Pursuit Narrative', f: [N('Top speed (mph)'), A('Route taken'), C('Spikes deployed'), C('PIT authorized')] },
    { id: 'tag-tow', title: 'Abandoned Vehicle / Tag-and-Tow', f: [T('Plate'), D('Tag placed'), T('Location')] },
    { id: 'parking', title: 'Parking / Fire Lane Enforcement', f: [T('Plate'), O('Violation', 'Hydrant', 'Double-park', 'Fire lane'), N('Vehicles involved')] },
    { id: 'motorist-assist', title: 'Disabled / Stranded Motorist Assist', f: [O('Assist type', 'Gas', 'Tire', 'Push-off'), T('Location')] },
  ] },
  { cat: '🔫 Violent Crimes & Tactical', reports: [
    { id: 'active-shooter', title: 'Active Shooter Post-Incident Briefing', f: [A('Entry vectors'), A('Clear sequence'), N('Casualties')] },
    { id: 'hostage', title: 'Hostage Negotiation Log', f: [A('Timeline'), A('Suspect demands'), C('SWAT dynamic entry')] },
    { id: 'armed-robbery', title: 'Armed Robbery / Heist Profile', f: [T('Weapon'), C('Silent alarm tripped'), N('Vault count')] },
    { id: 'drive-by', title: 'Drive-By Shooting Evidence Sheet', f: [T('Caliber'), N('Shell casings'), T('Target property')] },
    { id: 'gta', title: 'Grand Theft Auto Report', f: [T('Vehicle'), C('Hotwired'), T('Chop-shop location')] },
    { id: 'kidnap', title: 'Kidnapping & Amber Alert', f: [A('Victim description'), T('Last seen clothing'), T('Suspect vehicle')] },
    { id: 'less-lethal', title: 'Weapon Discharge Review (Non-Lethal)', f: [O('Weapon', 'Beanbag', 'Taser', 'Pepperball'), N('Rounds')] },
    { id: 'assault', title: 'Assault & Battery Intake', f: [A('Victim injuries'), T('Weapon type'), C('Domestic context')] },
    { id: 'terroristic', title: 'Terroristic Threats Report', f: [O('Threat type', 'Verbal', 'Written', 'Radio'), T('Target'), A('Details')] },
  ] },
  { cat: '🧪 Narcotics, Vice & Contraband', reports: [
    { id: 'field-test', title: 'Narcotics Field Test Certification', f: [T('Substance'), T('Color change'), N('Weight (g)')] },
    { id: 'pill-mill', title: 'Illicit Pill Mill / Manufacturing', f: [A('Items seized'), N('Scales'), C('Pill press seized')] },
    { id: 'sting', title: 'Undercover Sting Operation Plan', f: [A('Buy-money serials'), T('Wire setup'), T('Takedown signal')] },
    { id: 'vice', title: 'Prostitution / Vice Solicitation', f: [T('Location'), T('Ads used'), C('Audio captured')] },
    { id: 'gambling', title: 'Illegal Gambling / Casino Audit', f: [C('Ledgers seized'), N('Tables'), N('Cash bank ($)')] },
    { id: 'open-container', title: 'Alcohol Contraband / Open Container', f: [T('Container type'), T('Location')] },
    { id: 'rx-fraud', title: 'Prescription Fraud / Forgery', f: [T('Pad type'), T('Stolen doctor ID'), T('Substance')] },
  ] },
  { cat: '🏡 Property Crimes & Disturbances', reports: [
    { id: 'burglary', title: 'Burglary / Breaking & Entering', f: [T('Entry point'), C('Alarm bypassed'), A('Stolen items')] },
    { id: 'vandalism', title: 'Vandalism & Gang Graffiti', f: [T('Tag name'), T('Paint color'), N('Damage est ($)')] },
    { id: 'trespass', title: 'Trespassing & Trespass Warning', f: [T('Property'), T('Banned player')] },
    { id: 'shoplift', title: 'Shoplifting / Retail Theft Intake', f: [T('Store'), A('Items'), N('Recovered value ($)')] },
    { id: 'arson', title: 'Arson & Incendiary Device Analysis', f: [T('Accelerant'), A('Burn pattern'), C('Fire dept linked')] },
    { id: 'extortion', title: 'Extortion / Blackmail Log', f: [A('Threat text'), N('Amount demanded ($)')] },
    { id: 'noise', title: 'Noise Complaint / Public Nuisance', f: [N('Decibels'), N('Party size'), C('Warning issued')] },
    { id: 'neighbor', title: 'Neighbor Dispute Mediation', f: [A('Parties'), A('Resolution')] },
  ] },
  { cat: '⚖️ Court, Warrants & Legal Orders', reports: [
    { id: 'search-warrant', title: 'Emergency Search Warrant Request', f: [T('Address'), A('Probable cause')] },
    { id: 'arrest-affidavit', title: 'Felony Arrest Warrant Affidavit', f: [T('Suspect'), A('Probable cause')] },
    { id: 'tro', title: 'Temporary Restraining Order (TRO)', f: [T('Party A'), T('Party B'), T('Distance bound')] },
    { id: 'subpoena', title: 'Subpoena Service Confirmation', f: [T('Recipient'), D('Court date'), C('Served')] },
    { id: 'forfeiture', title: 'Asset Forfeiture / Cash Seizure', f: [N('Amount ($)'), T('Source')] },
    { id: 'fta', title: 'Failure to Appear (FTA) Bench Warrant', f: [T('Suspect'), D('Missed date')] },
    { id: 'contempt', title: 'Contempt of Court Profile', f: [T('Player'), A('Reason')] },
    { id: 'parole-violation', title: 'Parole / Probation Violation', f: [T('Offender'), A('Violation')] },
  ] },
  { cat: '🛡️ Special Operations & Units', reports: [
    { id: 'k9', title: 'K9 Deployment & Narcotics Alert', f: [A('Track path'), C('Positive alert')] },
    { id: 'air-support', title: 'Air Support Tracking / FLIR Log', f: [A('Flight path'), C('Spotlight used')] },
    { id: 'bomb-threat', title: 'Bomb Threat / Suspicious Package', f: [T('Evacuation bounds'), C('Robot deployed')] },
    { id: 'riot', title: 'Riot / Civil Unrest Deployment', f: [C('Tear gas'), N('Shield line size'), C('Dispersal announced')] },
    { id: 'marine', title: 'Marine Patrol / Watercraft Audit', f: [T('Boat registration'), C('Life vest violation')] },
    { id: 'vip-escort', title: 'Executive Protection / VIP Escort', f: [T('Protectee'), A('Route')] },
    { id: 'wildlife', title: 'Fish & Wildlife / Poaching', f: [T('Violation'), T('Firearm')] },
  ] },
  { cat: '📝 Administrative & Internal Affairs', reports: [
    { id: 'injury', title: 'Officer Injury / Worker Comp Intake', f: [A('Injury'), C('On shift')] },
    { id: 'cruiser-damage', title: 'Cruiser Damage / Collision', f: [A('Damage'), C('At fault')] },
    { id: 'ia-complaint', title: 'Internal Affairs Citizen Complaint', f: [O('Allegation', 'Brutality', 'Corruption', 'Powergaming'), A('Details')] },
    { id: 'uof-verdict', title: 'Use of Force Review Board Verdict', f: [O('Finding', 'Within Policy', 'Out of Policy'), A('Notes')] },
    { id: 'requisition', title: 'Equipment Requisition / Refill', f: [T('Item'), N('Quantity')] },
    { id: 'merit', title: 'Promotion / Demotion Merit Card', f: [T('Officer'), O('Action', 'Promotion', 'Demotion'), T('New rank')] },
    { id: 'discipline', title: 'Disciplinary Action / Suspension', f: [T('Officer'), A('Action')] },
  ] },
  { cat: '👥 Civilian & Welfare Inquiries', reports: [
    { id: 'missing-person', title: 'Missing Person Case File', f: [A('Description'), T('Last seen clothing'), A('Friend network')] },
    { id: 'welfare', title: 'Welfare Check / Mental Health', f: [O('Type', 'Suicide threat', 'Wellness', 'Outreach'), A('Outcome')] },
    { id: 'found-property', title: 'Found Property / Safekeeping', f: [T('Item'), T('Held at')] },
    { id: 'runaway', title: 'Runaway Juvenile Case Sheet', f: [T('Youth'), T('Family contact')] },
    { id: 'animal-control', title: 'Animal Control / Dangerous Dog', f: [T('Animal'), C('Bite reported')] },
    { id: 'sovereign', title: 'Sovereign Citizen Contact Log', f: [T('Player'), A('Behavior / claims')] },
  ] },
  { cat: '⭐ Core Incident Reports', reports: [
    { id: 'use-of-force', title: 'Use of Force Report', f: [C('Weapon discharged'), C('Taser deployed'), A('Compliance metrics')] },
    { id: 'fi-card', title: 'Field Interview (FI) Card', f: [A('Subject description'), T('Gang affiliation'), T('Location')] },
    { id: 'accident', title: 'Traffic Accident Diagram & Log', f: [N('Vehicles involved'), A('Collision points'), O('Fault', 'Vehicle 1', 'Vehicle 2', 'Shared'), T('Hazards')] },
    { id: 'impound', title: 'Vehicle Impound Document', f: [T('Tow company'), A('Damage status'), A('Vehicle contents')] },
    { id: 'death-cert', title: 'In-Game Death Certificate', f: [T('Time of death'), A('Preliminary cause'), T('Coroner')] },
    { id: 'robbery', title: 'Robbery & Theft Incident', f: [A('Item list'), N('Estimated value ($)'), A('Witness statements')] },
  ] },
];

// Structured catalog for the client (parse [label,type,opts] → {key,label,type,options}).
function fieldObj([label, type, options]) {
  return { key: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), label, type: type || 'text', options: options || null };
}
export function reportCatalog() {
  return CATALOG.map((c) => ({ cat: c.cat, reports: c.reports.map((r) => ({ id: r.id, title: r.title, fields: r.f.map(fieldObj) })) }));
}

const db = getDb();
db.exec(`CREATE TABLE IF NOT EXISTS cad_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id TEXT NOT NULL, type TEXT, title TEXT,
  officer TEXT, subject TEXT, data TEXT, created_at INTEGER
)`);
const q = {
  add: db.prepare('INSERT INTO cad_reports(guild_id,type,title,officer,subject,data,created_at) VALUES (?,?,?,?,?,?,?)'),
  list: db.prepare('SELECT id,type,title,officer,subject,created_at FROM cad_reports WHERE guild_id=? ORDER BY id DESC LIMIT 60'),
  get: db.prepare('SELECT * FROM cad_reports WHERE id=? AND guild_id=?'),
};
export function saveReport(g, r) {
  return Number(q.add.run(g, (r.type || 'custom').slice(0, 40), (r.title || 'Report').slice(0, 100), (r.officer || '').slice(0, 60), (r.subject || '').slice(0, 60), JSON.stringify(r.data || {}).slice(0, 8000), Date.now()).lastInsertRowid);
}
export function listReports(g) { return q.list.all(g); }
export function getReport(g, id) { const r = q.get.get(id, g); if (!r) return null; let d = {}; try { d = JSON.parse(r.data); } catch { /* corrupt */ } return { ...r, data: d }; }
