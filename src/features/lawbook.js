// Law Book — a Unified Penal Code (a comprehensive, standardized charge list used
// across all 50 states) plus real per-state data. This is an honest roleplay-grade
// reference, NOT a verbatim reproduction of each state's statute code (there is no
// single accurate 50-state statute set to hand-type, and faking statute numbers
// would be misleading). The per-STATE facts that ARE real — max highway speed limit
// and capital — are accurate.
//
// Charge tuple: [code, title, category, class, jailMonths, fine]

const P = [
  // ---- Traffic ----
  ['T-101', 'Speeding', 'Traffic', 'Infraction', 0, 250],
  ['T-102', 'Reckless Driving', 'Traffic', 'Misdemeanor', 3, 750],
  ['T-103', 'Driving Under the Influence', 'Traffic', 'Misdemeanor', 6, 1500],
  ['T-104', 'Driving While License Suspended', 'Traffic', 'Misdemeanor', 2, 500],
  ['T-105', 'Driving Without a License', 'Traffic', 'Infraction', 0, 300],
  ['T-106', 'Failure to Stop / Yield', 'Traffic', 'Infraction', 0, 200],
  ['T-107', 'Running a Red Light', 'Traffic', 'Infraction', 0, 250],
  ['T-108', 'Seatbelt Violation', 'Traffic', 'Infraction', 0, 100],
  ['T-109', 'Illegal Parking', 'Traffic', 'Infraction', 0, 75],
  ['T-110', 'Expired Registration', 'Traffic', 'Infraction', 0, 150],
  ['T-111', 'Driving Without Insurance', 'Traffic', 'Infraction', 0, 500],
  ['T-112', 'Hit and Run', 'Traffic', 'Felony', 12, 2500],
  ['T-113', 'Street Racing', 'Traffic', 'Misdemeanor', 3, 1000],
  ['T-114', 'Distracted Driving (Phone)', 'Traffic', 'Infraction', 0, 200],
  ['T-115', 'Failure to Signal', 'Traffic', 'Infraction', 0, 100],
  ['T-116', 'Improper Lane Change', 'Traffic', 'Infraction', 0, 150],
  ['T-117', 'Following Too Closely', 'Traffic', 'Infraction', 0, 150],
  ['T-118', 'Excessive Speeding (25+ over)', 'Traffic', 'Misdemeanor', 1, 600],
  // ---- Crimes Against Persons ----
  ['V-201', 'Simple Assault', 'Person', 'Misdemeanor', 6, 1000],
  ['V-202', 'Aggravated Assault', 'Person', 'Felony', 36, 5000],
  ['V-203', 'Battery', 'Person', 'Misdemeanor', 6, 1000],
  ['V-204', 'Domestic Violence', 'Person', 'Felony', 24, 4000],
  ['V-205', 'Assault on a Peace Officer', 'Person', 'Felony', 48, 7500],
  ['V-206', 'Kidnapping', 'Person', 'Felony', 120, 15000],
  ['V-207', 'False Imprisonment', 'Person', 'Felony', 24, 5000],
  ['V-208', 'Manslaughter', 'Person', 'Felony', 120, 20000],
  ['V-209', 'Murder (Second Degree)', 'Person', 'Felony', 300, 50000],
  ['V-210', 'Murder (First Degree)', 'Person', 'Felony', 600, 100000],
  ['V-211', 'Attempted Murder', 'Person', 'Felony', 180, 40000],
  ['V-212', 'Terroristic Threats', 'Person', 'Felony', 24, 5000],
  ['V-213', 'Stalking', 'Person', 'Misdemeanor', 12, 2000],
  ['V-214', 'Harassment', 'Person', 'Misdemeanor', 3, 750],
  ['V-215', 'Reckless Endangerment', 'Person', 'Misdemeanor', 6, 1500],
  // ---- Crimes Against Property ----
  ['P-301', 'Petty Theft', 'Property', 'Misdemeanor', 2, 500],
  ['P-302', 'Grand Theft', 'Property', 'Felony', 24, 5000],
  ['P-303', 'Grand Theft Auto', 'Property', 'Felony', 36, 7500],
  ['P-304', 'Burglary', 'Property', 'Felony', 48, 10000],
  ['P-305', 'Robbery', 'Property', 'Felony', 60, 12000],
  ['P-306', 'Armed Robbery', 'Property', 'Felony', 96, 20000],
  ['P-307', 'Carjacking', 'Property', 'Felony', 72, 15000],
  ['P-308', 'Vandalism', 'Property', 'Misdemeanor', 3, 750],
  ['P-309', 'Arson', 'Property', 'Felony', 84, 18000],
  ['P-310', 'Trespassing', 'Property', 'Misdemeanor', 1, 300],
  ['P-311', 'Shoplifting', 'Property', 'Misdemeanor', 2, 400],
  ['P-312', 'Receiving Stolen Property', 'Property', 'Felony', 18, 3000],
  ['P-313', 'Criminal Mischief', 'Property', 'Misdemeanor', 2, 500],
  // ---- Drugs & Alcohol ----
  ['D-401', 'Possession of a Controlled Substance', 'Drugs', 'Misdemeanor', 6, 1500],
  ['D-402', 'Possession w/ Intent to Distribute', 'Drugs', 'Felony', 48, 10000],
  ['D-403', 'Drug Trafficking', 'Drugs', 'Felony', 120, 25000],
  ['D-404', 'Manufacturing a Controlled Substance', 'Drugs', 'Felony', 96, 20000],
  ['D-405', 'Public Intoxication', 'Drugs', 'Infraction', 0, 250],
  ['D-406', 'Possession of Drug Paraphernalia', 'Drugs', 'Misdemeanor', 1, 400],
  // ---- Weapons ----
  ['W-501', 'Unlawful Possession of a Firearm', 'Weapons', 'Felony', 24, 5000],
  ['W-502', 'Carrying a Concealed Weapon (No Permit)', 'Weapons', 'Misdemeanor', 6, 1500],
  ['W-503', 'Brandishing a Weapon', 'Weapons', 'Misdemeanor', 6, 2000],
  ['W-504', 'Discharging a Firearm in Public', 'Weapons', 'Felony', 24, 5000],
  ['W-505', 'Possession of an Illegal Weapon', 'Weapons', 'Felony', 36, 7500],
  ['W-506', 'Felon in Possession of a Firearm', 'Weapons', 'Felony', 60, 12000],
  // ---- Public Order & Justice ----
  ['O-601', 'Disorderly Conduct', 'Public Order', 'Misdemeanor', 1, 500],
  ['O-602', 'Disturbing the Peace', 'Public Order', 'Infraction', 0, 300],
  ['O-603', 'Rioting', 'Public Order', 'Felony', 24, 5000],
  ['O-604', 'Unlawful Assembly', 'Public Order', 'Misdemeanor', 3, 1000],
  ['O-605', 'Resisting Arrest', 'Public Order', 'Misdemeanor', 6, 1500],
  ['O-606', 'Obstruction of Justice', 'Public Order', 'Misdemeanor', 6, 2000],
  ['O-607', 'Evading Police', 'Public Order', 'Felony', 24, 5000],
  ['O-608', 'Fleeing and Eluding', 'Public Order', 'Felony', 36, 7500],
  ['O-609', 'Failure to Comply', 'Public Order', 'Misdemeanor', 3, 1000],
  ['O-610', 'Providing False Information', 'Public Order', 'Misdemeanor', 3, 1000],
  ['O-611', 'Impersonating an Officer', 'Public Order', 'Felony', 24, 5000],
  ['O-612', 'Bribery', 'Public Order', 'Felony', 36, 10000],
  ['O-613', 'Tampering with Evidence', 'Public Order', 'Felony', 24, 6000],
  ['O-614', 'Loitering', 'Public Order', 'Infraction', 0, 150],
  ['O-615', 'Public Indecency', 'Public Order', 'Misdemeanor', 2, 600],
  ['O-616', 'Jaywalking', 'Public Order', 'Infraction', 0, 75],
  // ---- Financial & White-Collar ----
  ['F-701', 'Fraud', 'Financial', 'Felony', 36, 10000],
  ['F-702', 'Identity Theft', 'Financial', 'Felony', 48, 12000],
  ['F-703', 'Money Laundering', 'Financial', 'Felony', 72, 25000],
  ['F-704', 'Forgery', 'Financial', 'Felony', 24, 6000],
  ['F-705', 'Extortion', 'Financial', 'Felony', 48, 12000],
  ['F-706', 'Embezzlement', 'Financial', 'Felony', 36, 10000],
  ['F-707', 'Counterfeiting', 'Financial', 'Felony', 48, 15000],
  ['F-708', 'Tax Evasion', 'Financial', 'Felony', 36, 12000],
];

export const PENAL_CODE = P.map(([code, title, category, cls, jail, fine]) => ({ code, title, category, cls, jail, fine }));

// [name, abbr, capital, maxHighwaySpeedMph] — speed limits & capitals are real.
const S = [
  ['Alabama', 'AL', 'Montgomery', 70], ['Alaska', 'AK', 'Juneau', 65], ['Arizona', 'AZ', 'Phoenix', 75],
  ['Arkansas', 'AR', 'Little Rock', 75], ['California', 'CA', 'Sacramento', 70], ['Colorado', 'CO', 'Denver', 75],
  ['Connecticut', 'CT', 'Hartford', 65], ['Delaware', 'DE', 'Dover', 65], ['Florida', 'FL', 'Tallahassee', 70],
  ['Georgia', 'GA', 'Atlanta', 70], ['Hawaii', 'HI', 'Honolulu', 60], ['Idaho', 'ID', 'Boise', 80],
  ['Illinois', 'IL', 'Springfield', 70], ['Indiana', 'IN', 'Indianapolis', 70], ['Iowa', 'IA', 'Des Moines', 70],
  ['Kansas', 'KS', 'Topeka', 75], ['Kentucky', 'KY', 'Frankfort', 70], ['Louisiana', 'LA', 'Baton Rouge', 75],
  ['Maine', 'ME', 'Augusta', 75], ['Maryland', 'MD', 'Annapolis', 70], ['Massachusetts', 'MA', 'Boston', 65],
  ['Michigan', 'MI', 'Lansing', 75], ['Minnesota', 'MN', 'Saint Paul', 70], ['Mississippi', 'MS', 'Jackson', 70],
  ['Missouri', 'MO', 'Jefferson City', 70], ['Montana', 'MT', 'Helena', 80], ['Nebraska', 'NE', 'Lincoln', 75],
  ['Nevada', 'NV', 'Carson City', 80], ['New Hampshire', 'NH', 'Concord', 70], ['New Jersey', 'NJ', 'Trenton', 65],
  ['New Mexico', 'NM', 'Santa Fe', 75], ['New York', 'NY', 'Albany', 65], ['North Carolina', 'NC', 'Raleigh', 70],
  ['North Dakota', 'ND', 'Bismarck', 75], ['Ohio', 'OH', 'Columbus', 70], ['Oklahoma', 'OK', 'Oklahoma City', 75],
  ['Oregon', 'OR', 'Salem', 70], ['Pennsylvania', 'PA', 'Harrisburg', 70], ['Rhode Island', 'RI', 'Providence', 65],
  ['South Carolina', 'SC', 'Columbia', 70], ['South Dakota', 'SD', 'Pierre', 80], ['Tennessee', 'TN', 'Nashville', 70],
  ['Texas', 'TX', 'Austin', 85], ['Utah', 'UT', 'Salt Lake City', 80], ['Vermont', 'VT', 'Montpelier', 65],
  ['Virginia', 'VA', 'Richmond', 70], ['Washington', 'WA', 'Olympia', 70], ['West Virginia', 'WV', 'Charleston', 70],
  ['Wisconsin', 'WI', 'Madison', 70], ['Wyoming', 'WY', 'Cheyenne', 80],
];

export const STATES = S.map(([name, abbr, capital, limit]) => ({ name, abbr, capital, limit }));

export function getLawbook() {
  return { states: STATES, penalCode: PENAL_CODE, categories: [...new Set(PENAL_CODE.map((c) => c.category))] };
}
