'use strict';

/**
 * Dataset generation script.
 *
 * Outputs:
 *   data/hero-docs.json   — 5 hand-crafted documents
 *   data/dataset.json     — all 155 documents (5 hero + 150 generated)
 *
 * Distribution target: ~70% green / ~20% yellow / ~10% red
 * Red   = bare SSN (no dashes) planted so only recall's \b\d{9}\b catches it
 * Yellow = dash-format phone planted so only recall's \b\d{3}[-.\s]…\b catches it
 * Green  = all PII in detector-catchable formats; no recall hits
 *
 * Recurring entity pool: POOL_SIZE procedurally-generated entities (default 7),
 * each appears in 10–15 generated documents. Hero entities: 5 separate fixed
 * identities used only in the 5 hand-crafted hero documents.
 *
 * Offsets come exclusively from regex matches (m.index) — never hardcoded.
 */

const fs   = require('fs');
const path = require('path');

const { detect }      = require('../../backend/detection/mockDetector');
const { recallPass }  = require('../../backend/recall/recallPass');
const { computeTier } = require('../../backend/triage/tierEngine');

// ─────────────────────────────────────────────────────────────
// 1.  RANDOM DATA GENERATORS
// ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Sarah', 'Michael', 'Jennifer', 'Robert', 'Emily', 'William', 'Jessica',
  'David', 'Ashley', 'Richard', 'Amanda', 'Joseph', 'Melissa', 'Thomas', 'Stephanie',
  'Charles', 'Nicole', 'Christopher', 'Elizabeth', 'Daniel', 'Samantha', 'Matthew',
  'Lauren', 'Anthony', 'Rachel', 'Mark', 'Megan', 'Donald', 'Kayla',
  'Kevin', 'Amber', 'Brian', 'Heather', 'Steven', 'Brittany', 'Timothy', 'Crystal',
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia',
  'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez',
  'Moore', 'Martin', 'Jackson', 'Thompson', 'White', 'Lopez', 'Lee', 'Gonzalez',
  'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall',
  'Young', 'Allen', 'Sanchez', 'Wright', 'King', 'Scott', 'Green', 'Baker',
];
const EMAIL_DOMAINS = [
  'gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'hotmail.com',
  'company.org', 'workmail.net', 'techcorp.io', 'legalfirm.com', 'healthplus.org',
  'financegroup.net', 'courtservice.gov', 'rentpro.com', 'medclinic.org',
];
const STREETS = [
  'Maple Ave', 'Oak St', 'Pine Rd', 'Cedar Blvd', 'Elm Dr', 'Birch Ln',
  'Walnut Ct', 'Spruce Way', 'Ash Ave', 'Willow St', 'Poplar Rd', 'Cherry Blvd',
  'Sycamore St', 'Magnolia Dr', 'Hickory Ln', 'Chestnut Ave', 'Locust Rd',
];
const CITIES_STATES = [
  ['Springfield', 'IL', '62701'], ['Denver',    'CO', '80203'], ['Austin',    'TX', '78701'],
  ['Miami',       'FL', '33101'], ['Seattle',   'WA', '98101'], ['Boston',    'MA', '02101'],
  ['Chicago',     'IL', '60601'], ['Phoenix',   'AZ', '85001'], ['Atlanta',   'GA', '30301'],
  ['Portland',    'OR', '97201'], ['Nashville', 'TN', '37201'], ['Dallas',    'TX', '75201'],
  ['Columbus',    'OH', '43201'], ['Charlotte', 'NC', '28201'], ['Detroit',   'MI', '48201'],
];
const COMPANIES = [
  'Acme Corp', 'Nova Solutions', 'PineCrest LLC', 'BrightPath Inc',
  'Sterling Group', 'Atlas Ventures', 'Summit Partners', 'Meridian Associates',
  'Crestline Holdings', 'BlueRidge Consulting', 'Pinnacle Services', 'Apex Group',
  'Harrington & Cole', 'Westfield Dynamics', 'Oakwood Enterprises',
];
const ROLES = [
  'Software Engineer', 'Senior Analyst', 'Project Manager', 'Legal Consultant',
  'Financial Advisor', 'HR Specialist', 'Operations Lead', 'Data Scientist',
  'Compliance Officer', 'Business Development Manager', 'UX Designer', 'Marketing Director',
  'Product Manager', 'Security Analyst', 'Technical Writer',
];
const HOSPITALS = [
  'Riverside Medical Center', 'Lakeside General Hospital', 'Crestview Health System',
  'Northgate Clinic', 'Summit Regional Medical', 'Bayside Community Hospital',
  'Valley Orthopedic Institute', 'Greenfield Family Practice',
];
const DIAGNOSES = [
  'hypertension and chronic lower back pain',
  'Type 2 diabetes and peripheral neuropathy',
  'anxiety disorder and insomnia',
  'asthma and seasonal allergies',
  'hypothyroidism and vitamin D deficiency',
  'migraines and tension headaches',
  'atrial fibrillation and moderate hyperlipidemia',
  'osteoarthritis affecting bilateral knees',
];
const PHYSICIANS = [
  'Rachel Kim', 'Marcus Webb', 'Priya Nair', 'Alan Frost',
  'Diane Okafor', 'Samuel Torres', 'Grace Huang', 'Patrick Dolan',
];
const JUDGES = [
  'Hon. Patricia Moore', 'Hon. Thomas Kent', 'Hon. Susan Park', 'Hon. Gerald Hayes',
  'Hon. Catherine Reyes', 'Hon. Martin Osei',
];
const COURTS = [
  'District Court of Cook County', 'Superior Court of California',
  'Circuit Court of Travis County', 'Supreme Court of New York',
  'Court of Common Pleas, Allegheny County', 'United States District Court, N.D. Illinois',
];
const LANDLORDS = [
  'Greenfield Properties LLC', 'SunRise Realty Group', 'BlueKey Property Management',
  'Landmark Rental Associates', 'Crestwood Property Group', 'Harbor View Estates LLC',
];
const SERVICES = [
  'Legal Consultation Services — Contract Review',
  'Financial Advisory — Q3 Portfolio Analysis',
  'Compliance Audit Services — SOX Review',
  'Document Review & Analysis — Litigation Support',
  'Contract Negotiation Services — Vendor Agreements',
  'Tax Preparation Services — Individual Filing',
  'Investment Portfolio Review — Annual Assessment',
  'Corporate Restructuring Advisory',
  'Intellectual Property Search & Registration',
  'Human Resources Consulting — Policy Update',
];
const BANKS = ['Chase Bank', 'Bank of America', 'Wells Fargo', 'Citibank', 'PNC Bank', 'US Bancorp'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
function rnd(n)     { return Math.floor(Math.random() * n); }
function pad(n, w)  { return String(n).padStart(w, '0'); }

function randName() {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function randSSN() {
  return `${100 + rnd(800)}-${pad(10 + rnd(80), 2)}-${1000 + rnd(9000)}`;
}
function ssnToBare(ssn) {
  return ssn.replace(/-/g, '');
}
function randPhone() {
  // Stored in plain-dash format: NNN-NNN-NNNN
  return `${200 + rnd(700)}-${200 + rnd(700)}-${1000 + rnd(9000)}`;
}
function randEmail(name) {
  const parts = name.toLowerCase().replace(/[^a-z ]/g, '').split(' ');
  const [first, last] = parts;
  const user = pick([
    `${first}.${last}`,
    `${first}${last[0]}`,
    `${first[0]}.${last}`,
    `${first}_${last}`,
    `${first}${last}`,
  ]);
  return `${user}@${pick(EMAIL_DOMAINS)}`;
}
function randAddress() {
  const [city, state, zip] = pick(CITIES_STATES);
  return `${100 + rnd(9900)} ${pick(STREETS)}, ${city}, ${state} ${zip}`;
}
function randDate(startYear = 2020) {
  return `${startYear + rnd(5)}-${pad(1 + rnd(12), 2)}-${pad(1 + rnd(28), 2)}`;
}
function randDOB() {
  return `${1958 + rnd(42)}-${pad(1 + rnd(12), 2)}-${pad(1 + rnd(28), 2)}`;
}

// ─────────────────────────────────────────────────────────────
// 2.  PHONE / SSN FORMATTERS
//     Controls what the detector and recall each see.
// ─────────────────────────────────────────────────────────────

// (NNN) NNN-NNNN  →  detector PHONE pattern catches this
function detectorPhone(phone) {
  return `(${phone.slice(0, 3)}) ${phone.slice(4)}`;
}
// NNN-NNN-NNNN    →  recall PHONE pattern catches; detector misses (no parens)
function dashPhone(phone) { return phone; }
// NNN.NNN.NNNN    →  recall PHONE pattern catches ([-.\s] matches dots); detector misses
function dotPhone(phone)  { return phone.replace(/-/g, '.'); }

// NNN-NN-NNNN     →  detector SSN pattern catches this
function dashedSSN(ssn) { return ssn; }
// NNNNNNNNN       →  recall \b\d{9}\b catches; detector misses (requires dashes)
function bareSSN(ssn)   { return ssnToBare(ssn); }

// ─────────────────────────────────────────────────────────────
// 3.  ENTITY FACTORIES
// ─────────────────────────────────────────────────────────────

function makeEntity(entityId, name, overrides = {}) {
  const ssn   = overrides.ssn   || randSSN();
  const phone = overrides.phone || randPhone();
  const email = overrides.email || randEmail(name);
  const addr  = overrides.address || randAddress();
  return { entityId, name, ssn, ssnBare: ssnToBare(ssn), phone, email, address: addr };
}

// Curated, recognizable full names for the recurring entities. Only the
// identity label is fixed here — each entity's SSN / phone / email / address
// remain procedurally generated by makeEntity.
const RECURRING_NAMES = [
  'John Smith', 'Sarah Johnson', 'Robert Lee', 'Maria Garcia', 'David Chen',
  'Emily Ross', 'Michael Brown', 'Jennifer Martinez', 'James Wilson', 'Linda Nguyen',
  'Daniel Carter', 'Patricia Adams', 'Christopher Hayes', 'Angela Foster', 'Kevin Patel',
  'Rachel Greene', 'Anthony Russo', 'Olivia Bennett', 'Marcus Reed', 'Sophia Turner',
];

// Recurring (cross-document) entity pool — names are drawn from the curated list
// above; everything else stays procedural so the size and underlying PII are
// configurable, not hand-pinned. Each entity appears in multiple generated
// documents and carries a stable entityId so propagation can find every doc.
const POOL_SIZE = 7; // number of recurring identities; each lands in ~10–15 docs

function entityIdFromName(name) {
  return 'ent_' + name.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '');
}

function buildRecurringPool(size) {
  if (size > RECURRING_NAMES.length) {
    throw new Error(`POOL_SIZE ${size} exceeds curated name list (${RECURRING_NAMES.length})`);
  }
  // Shuffle a copy of the curated names, then take the first `size`.
  const names = [...RECURRING_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [names[i], names[j]] = [names[j], names[i]];
  }
  return names.slice(0, size).map(name =>
    makeEntity(entityIdFromName(name), name) // ssn / phone / email / address randomized
  );
}

const RECURRING_POOL = buildRecurringPool(POOL_SIZE);

// 5 hero entities — dedicated to the hand-crafted documents only.
const HERO_ENTITIES = {
  whitmore: makeEntity('ent_james_whitmore', 'James Whitmore', { ssn: '523-61-4490', phone: '617-834-2291', email: 'j.whitmore@bostonlaw.com',    address: '14 Beacon St, Boston, MA 02108'        }),
  torres:   makeEntity('ent_rachel_torres',  'Rachel Torres',  { ssn: '381-74-9920', phone: '312-504-7823', email: 'rachel.torres@novamedia.io',   address: '55 Michigan Ave, Chicago, IL 60601'    }),
  kim:      makeEntity('ent_samuel_kim',     'Samuel Kim',     { ssn: '209-47-8831', phone: '415-772-4410', email: 'samuel.kim@tradestation.com',  address: '330 Market St, San Francisco, CA 94105'}),
  patel:    makeEntity('ent_diana_patel',    'Diana Patel',    { ssn: '714-33-6652', phone: '602-881-5500', email: 'dpatel@sunrealty.net',         address: '88 Desert View Rd, Phoenix, AZ 85021'  }),
  wei:      makeEntity('ent_chen_wei',       'Chen Wei',       { ssn: '463-58-1190', phone: '425-663-8847', email: 'chen.wei@quantumfund.io',      address: '7 Innovation Way, Seattle, WA 98109'   }),
};

// One-off entity: randomly generated, no cross-doc entityId.
function makeOneOff() {
  const name = randName();
  const ssn  = randSSN();
  return {
    entityId: null,
    name,
    ssn,
    ssnBare: ssnToBare(ssn),
    phone:   randPhone(),
    email:   randEmail(name),
    address: randAddress(),
  };
}

// ─────────────────────────────────────────────────────────────
// 4.  DOCUMENT TEMPLATE BUILDERS
//     plantedMiss: 'none' | 'phone' | 'ssn'
//     'none'  → all PII in detector-catchable formats           → green
//     'phone' → phone in dash/dot format, SSN normal           → yellow
//     'ssn'   → SSN as 9-digit bare number, phone normal       → red
// ─────────────────────────────────────────────────────────────

function phoneFor(entity, plantedMiss) {
  return plantedMiss === 'phone' ? dashPhone(entity.phone) : detectorPhone(entity.phone);
}
function ssnFor(entity, plantedMiss) {
  return plantedMiss === 'ssn' ? bareSSN(entity.ssn) : dashedSSN(entity.ssn);
}

const TEMPLATES = {

  employment_contract(entity, plantedMiss) {
    const company  = pick(COMPANIES);
    const employer = pick(COMPANIES.filter(c => c !== company));
    const role     = pick(ROLES);
    const date     = randDate();
    const salary   = (60000 + rnd(80000)).toLocaleString();
    const pto      = 10 + rnd(16);
    const notice   = pick([14, 30, 60]);
    return {
      title: `Employment Contract – ${entity.name} / ${company}`,
      text:
`EMPLOYMENT AGREEMENT

This agreement is entered into as of ${date} between ${employer} ("Employer")
and ${entity.name} ("Employee").

1. POSITION
   Title:       ${role}
   Department:  ${pick(['Engineering', 'Operations', 'Finance', 'Legal', 'Marketing'])}
   Start Date:  ${randDate(2023)}
   Work Mode:   ${pick(['On-site', 'Remote', 'Hybrid (3 days on-site)'])}

2. PERSONAL DETAILS
   Full Name:              ${entity.name}
   Social Security Number: ${ssnFor(entity, plantedMiss)}
   Email Address:          ${entity.email}
   Contact Number:         ${phoneFor(entity, plantedMiss)}
   Home Address:           ${entity.address}

3. COMPENSATION
   Annual Base Salary: $${salary}, paid bi-weekly via direct deposit.
   Signing Bonus:      $${(2000 + rnd(8000)).toLocaleString()} (clawback if separated within 12 months).
   Annual Bonus:       Up to ${5 + rnd(20)}% of base at Employer's discretion.
   Benefits:           Medical, dental, vision; ${pto} days PTO; 401(k) with ${3 + rnd(3)}% match.

4. CONFIDENTIALITY
   Employee shall not disclose any proprietary or trade-secret information
   during or after the term of employment. Violation is grounds for immediate
   termination and may result in legal action.

5. TERMINATION
   Either party may terminate with ${notice} days' written notice.
   Employer may terminate for cause (fraud, gross misconduct) without notice.

Signature (Employee):  _________________________   Date: ________
Signature (Employer):  _________________________   Date: ________`,
    };
  },

  medical_report(entity, plantedMiss) {
    const hospital  = pick(HOSPITALS);
    const physician = pick(PHYSICIANS);
    const diagnosis = pick(DIAGNOSES);
    const dob       = randDOB();
    const insId     = `INS-${100000 + rnd(900000)}`;
    const weeks     = 4 + rnd(8);
    const rx        = pick([
      'lisinopril 10mg once daily',
      'metformin 500mg twice daily with meals',
      'sertraline 50mg once daily',
      'albuterol inhaler as needed (PRN)',
      'atorvastatin 20mg at bedtime',
      'levothyroxine 50mcg once daily on empty stomach',
    ]);
    return {
      title: `Medical Report – ${entity.name} – ${hospital}`,
      text:
`CONFIDENTIAL MEDICAL REPORT
${hospital}

Patient Name:       ${entity.name}
Date of Birth:      ${dob}
SSN:                ${ssnFor(entity, plantedMiss)}
Insurance ID:       ${insId}
Treating Physician: Dr. ${physician}
Visit Date:         ${randDate(2023)}

PRIMARY DIAGNOSIS
The patient presents with ${diagnosis}.
Onset reported approximately ${1 + rnd(10)} year(s) ago with progressive severity.

SECONDARY FINDINGS
${pick([
  'Elevated LDL cholesterol (214 mg/dL) noted on recent bloodwork.',
  'BMI of 28.4 — patient counseled on diet and exercise.',
  'Blood pressure 148/92 mmHg at time of visit.',
  'Mild anemia; ferritin level 11 ng/mL.',
])}

CONTACT INFORMATION
Phone:   ${phoneFor(entity, plantedMiss)}
Email:   ${entity.email}
Address: ${entity.address}

TREATMENT PLAN
Medication: ${rx}.
Follow-up: ${weeks} weeks at ${hospital}.
Referral: ${pick(['Physical therapy', 'Cardiology', 'Endocrinology', 'Neurology', 'Orthopedics'])}.

CONFIDENTIALITY NOTICE
This document contains Protected Health Information (PHI) under HIPAA.
Unauthorized access, use, or disclosure is a federal offense.`,
    };
  },

  court_affidavit(entity, plantedMiss) {
    const caseNo = `${2020 + rnd(5)}-CV-${10000 + rnd(89999)}`;
    const court  = pick(COURTS);
    const judge  = pick(JUDGES);
    const dob    = randDOB();
    const month  = pick(MONTHS_LONG);
    const day    = 10 + rnd(18);
    const year   = 2022 + rnd(4);
    return {
      title: `Court Affidavit – ${entity.name} – Case ${caseNo}`,
      text:
`AFFIDAVIT OF ${entity.name.toUpperCase()}

${court}
CASE NO.: ${caseNo}
Presiding: ${judge}

I, ${entity.name}, being duly sworn under penalty of perjury, state as follows:

1. IDENTIFICATION
   Full Legal Name:           ${entity.name}
   Date of Birth:             ${dob}
   Social Security Number:    ${ssnFor(entity, plantedMiss)}
   Current Address:           ${entity.address}

2. BACKGROUND
   I am ${pick([
     'a licensed contractor with 12 years of experience in commercial construction',
     'a registered nurse employed at a regional hospital for seven years',
     'a certified public accountant practicing for fifteen years',
     'a licensed real estate broker operating in this county for nine years',
     'a software developer employed in the technology sector for six years',
   ])}.

3. STATEMENT OF FACTS
   On or about the date referenced in the above-captioned case, I was present
   and have firsthand knowledge of the events described in the attached complaint.
   I can attest to their accuracy to the best of my personal knowledge.

4. CONTACT
   I may be reached at ${entity.email} or ${phoneFor(entity, plantedMiss)}.
   All formal correspondence should be directed through my counsel.

5. DECLARATION
   I declare under penalty of perjury that the foregoing is true and correct.

Executed this ${day} day of ${month}, ${year}.

Signature of Affiant: ________________________
Notary Public:        ______________________________
Commission Expires:   December 31, ${year + 2}`,
    };
  },

  lease_agreement(entity, plantedMiss) {
    const landlord  = pick(LANDLORDS);
    const startDate = `${2022 + rnd(3)}-${pad(1 + rnd(12), 2)}-01`;
    const rent      = 900 + rnd(2100);
    const deposit   = Math.round(rent * 1.5 / 50) * 50;
    const prevAddr  = randAddress();
    return {
      title: `Lease Agreement – ${entity.name} – ${entity.address}`,
      text:
`RESIDENTIAL LEASE AGREEMENT

Landlord:         ${landlord}
Tenant:           ${entity.name}
Property Address: ${entity.address}

LEASE TERM
Commences: ${startDate}. Term: twelve (12) months.
Auto-renews month-to-month unless 60-day written notice given by either party.

FINANCIAL TERMS
Monthly Rent:     $${rent}.00, due on the 1st of each month.
Security Deposit: $${deposit}.00 (collected at signing; refundable per state law).
Late Fee:         $75.00 assessed after a 5-day grace period.
NSF Fee:          $35.00 for returned checks.

TENANT IDENTIFICATION
Full Name:          ${entity.name}
SSN (credit check): ${ssnFor(entity, plantedMiss)}
Phone:              ${phoneFor(entity, plantedMiss)}
Email:              ${entity.email}
Previous Address:   ${prevAddr}

UTILITY RESPONSIBILITIES
Tenant:   electricity, gas, internet/cable, renter's insurance (min $100K liability).
Landlord: water, trash removal, pest control, common-area maintenance.

PROPERTY CARE
Tenant shall maintain the property in clean and sanitary condition.
No modifications, alterations, or improvements without prior written consent.
No smoking anywhere on the premises, including balconies and common areas.
Pets: ${pick(['Not permitted without a separate pet addendum and $300 pet deposit.', 'Maximum one (1) cat; $200 non-refundable pet fee.', 'Not permitted.'])}

LANDLORD ENTRY
24-hour written notice required except in emergencies.

Tenant Signature: ______________________   Date: ________
Landlord Signature: ____________________   Date: ________`,
    };
  },

  financial_invoice(entity, plantedMiss) {
    const invNo   = `INV-${10000 + rnd(89999)}`;
    const company = pick(COMPANIES);
    const service = pick(SERVICES);
    const invDate = randDate(2023);
    const amount  = (800 + rnd(18000)).toFixed(2);
    const tax     = (parseFloat(amount) * 0.08).toFixed(2);
    const total   = (parseFloat(amount) * 1.08).toFixed(2);
    const bank    = pick(BANKS);
    // Use a masked account number — avoids accidental 9-digit recall SSN hits
    const acct    = `****-${1000 + rnd(9000)}`;
    return {
      title: `Financial Invoice – ${company} – ${invNo}`,
      text:
`INVOICE

Invoice Number: ${invNo}
Invoice Date:   ${invDate}
Payment Terms:  Net 30
Currency:       USD

BILLED TO:
${entity.name}
${entity.address}
Email:  ${entity.email}
Phone:  ${phoneFor(entity, plantedMiss)}
Tax ID: ${ssnFor(entity, plantedMiss)}

BILLED FROM:
${company}
1 Corporate Plaza, New York, NY 10001
billing@${company.toLowerCase().replace(/[^a-z]/g, '')}.com

SERVICES RENDERED:
${service}

SUBTOTAL:  $${amount}
TAX (8%):  $${tax}
TOTAL DUE: $${total}

PAYMENT INSTRUCTIONS:
Bank:             ${bank}
Account (masked): ${acct}
Reference:        ${invNo}

Late payments accrue interest at 1.5% per month.
Questions? Contact billing@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`,
    };
  },
};

// ─────────────────────────────────────────────────────────────
// 5.  HERO DOCUMENTS  (hand-crafted, one per tier scenario)
// ─────────────────────────────────────────────────────────────

function buildHeroDocs() {
  const { whitmore, torres, kim, patel, wei } = HERO_ENTITIES;

  // H01: Medical Report — RED (bare SSN planted; detector phone present for contrast)
  const h01 = {
    id: 'doc_H01',
    category: 'medical_report',
    entity: whitmore,
    title: `Medical Report – ${whitmore.name} – Riverside Medical Center`,
    text:
`CONFIDENTIAL MEDICAL REPORT
Riverside Medical Center
1 Medical Center Drive, Boston, MA 02114

Patient Name:       ${whitmore.name}
Date of Birth:      1971-03-14
SSN on File:        ${bareSSN(whitmore.ssn)}
Insurance ID:       INS-748291
Treating Physician: Dr. Diane Okafor
Visit Date:         2024-02-08

PRIMARY DIAGNOSIS
Mr. Whitmore presents with Stage 1 hypertension and chronic lumbar disc compression
at L4–L5. Symptoms have persisted for approximately three years with progressive
severity, particularly following prolonged sitting or physical exertion.

SECONDARY FINDINGS
Elevated LDL cholesterol (218 mg/dL) noted during routine bloodwork in January 2024.
Patient reports an average of fewer than five hours of sleep nightly.

CONTACT INFORMATION
Phone:   ${detectorPhone(whitmore.phone)}
Email:   ${whitmore.email}
Address: ${whitmore.address}

TREATMENT PLAN
Medications: lisinopril 10mg once daily; atorvastatin 20mg at bedtime.
Physical therapy: twice weekly for eight weeks (PT referral attached).
Follow-up appointment: six weeks from today at Riverside Medical Center.

RECORDS REQUEST
All records requests require a signed HIPAA Authorization (Form RM-401).
Contact the Health Information Management department for assistance.

CONFIDENTIALITY NOTICE
This document contains Protected Health Information (PHI) under HIPAA §164.
Unauthorized access, use, or disclosure is a federal offense punishable by law.`,
  };

  // H02: Employment Contract — YELLOW (dash-format phone planted; SSN normal)
  const h02 = {
    id: 'doc_H02',
    category: 'employment_contract',
    entity: torres,
    title: `Employment Contract – ${torres.name} / Nova Media Inc`,
    text:
`EMPLOYMENT AGREEMENT

This agreement is entered into as of 2024-01-15 between Nova Media Inc ("Employer")
and ${torres.name} ("Employee").

1. POSITION
   Title:       Senior Content Strategist
   Department:  Marketing & Brand
   Start Date:  2024-02-03
   Work Mode:   Hybrid — Chicago, IL office (3 days on-site per week)

2. PERSONAL DETAILS
   Full Name:              ${torres.name}
   Social Security Number: ${dashedSSN(torres.ssn)}
   Primary Email:          ${torres.email}
   Work Phone (cell):      ${dashPhone(torres.phone)}
   Home Address:           ${torres.address}

3. COMPENSATION
   Base Salary:    $92,000 per year, paid bi-weekly via direct deposit.
   Signing Bonus:  $5,000 (subject to 12-month clawback upon early separation).
   Annual Bonus:   Up to 15% of base salary, based on individual and company performance.
   Benefits:       Medical, dental, vision; 20 days PTO; 401(k) with 5% employer match.

4. INTELLECTUAL PROPERTY
   All work product created in connection with employment belongs exclusively
   to Employer. Employee hereby irrevocably assigns all IP rights to Employer.

5. NON-COMPETE
   Employee agrees not to accept employment with a direct competitor within
   twelve (12) months of separation. Geographic scope: United States.
   This clause is subject to applicable state and local law.

6. TERMINATION
   Either party may terminate with 30 days' written notice.
   Employer may terminate for cause (material breach, fraud, gross misconduct) immediately.

Signature (Employee):  _________________________   Date: ________
Signature (Employer):  _________________________   Date: ________`,
  };

  // H03: Court Affidavit — GREEN (all PII in detector-catchable formats)
  const h03 = {
    id: 'doc_H03',
    category: 'court_affidavit',
    entity: kim,
    title: `Court Affidavit – ${kim.name} – Case 2023-CV-48821`,
    text:
`AFFIDAVIT OF ${kim.name.toUpperCase()}

Superior Court of California
CASE NO.: 2023-CV-48821
Presiding: Hon. Patricia Moore

I, ${kim.name}, being duly sworn under penalty of perjury, state as follows:

1. IDENTIFICATION
   Full Legal Name:           ${kim.name}
   Date of Birth:             1985-09-22
   Social Security Number:    ${dashedSSN(kim.ssn)}
   Current Address:           ${kim.address}

2. BACKGROUND
   I am a licensed securities trader with TradeStation Capital LLC, where I have
   been employed for seven years and am in good standing with FINRA.

3. STATEMENT OF FACTS
   On or about August 14, 2023, I reviewed the financial disclosures at issue in
   this proceeding. I have firsthand knowledge of the transactions described therein
   and can attest to their accuracy and completeness.
   The disclosures were prepared in accordance with SEC Rule 10b-5 and were filed
   timely with the Securities and Exchange Commission.

4. CONTACT
   I may be reached at ${kim.email} or by telephone at ${detectorPhone(kim.phone)}.
   All formal correspondence should be directed through my counsel at
   Harrington & Cole, LLP, San Francisco, CA.

5. DECLARATION
   I declare under penalty of perjury under the laws of the State of California
   that the foregoing is true and correct to the best of my knowledge.

Executed this 3rd day of October, 2023.

Signature of Affiant: ________________________
Notary Public:        ______________________________
Commission Expires:   December 31, 2025`,
  };

  // H04: Lease Agreement — RED (bare SSN + dash phone both planted)
  const h04 = {
    id: 'doc_H04',
    category: 'lease_agreement',
    entity: patel,
    title: `Lease Agreement – ${patel.name} – ${patel.address}`,
    text:
`RESIDENTIAL LEASE AGREEMENT

Landlord:         SunRise Realty Group
Tenant:           ${patel.name}
Property Address: ${patel.address}

LEASE TERM
Commences: 2024-03-01. Term: twelve (12) months.
Auto-renews month-to-month unless 60-day written notice given.

FINANCIAL TERMS
Monthly Rent:     $1,650.00, due on the 1st of each calendar month.
Security Deposit: $2,475.00 (1.5× monthly rent; refundable per ARS §33-1321).
Late Fee:         $100.00 if rent received after the 5-day grace period.
NSF Fee:          $35.00 for returned checks or failed ACH transfers.

TENANT IDENTIFICATION
Full Name:        ${patel.name}
Tax ID / SSN:     ${bareSSN(patel.ssn)}
Contact Phone:    ${dashPhone(patel.phone)}
Contact Email:    ${patel.email}
Prior Address:    200 Central Ave, Phoenix, AZ 85004

UTILITY RESPONSIBILITIES
Tenant:   electric, gas, internet/cable, renter's insurance ($100K liability minimum).
Landlord: water, trash, pest control, common-area maintenance.

PROPERTY CARE
Tenant shall maintain the property in clean, habitable condition.
No structural modifications without prior written consent from Landlord.
No smoking or vaping on the premises, including patios and balconies.

LANDLORD ENTRY
Landlord shall provide 24 hours' advance notice before entry, except in emergencies.

EARLY TERMINATION
Tenant may terminate early with 60 days' written notice and a fee equal to
two (2) months' rent, which serves as liquidated damages.

Tenant Signature: ______________________   Date: ________
Landlord Signature: ____________________   Date: ________
SunRise Realty Representative:              Date: ________`,
  };

  // H05: Financial Invoice — YELLOW (dot-format phone planted; SSN normal)
  const h05 = {
    id: 'doc_H05',
    category: 'financial_invoice',
    entity: wei,
    title: `Financial Invoice – Meridian Compliance Partners – INV-88421`,
    text:
`INVOICE

Invoice Number: INV-88421
Invoice Date:   2024-02-29
Payment Terms:  Net 30
Project Ref:    QFUND-2024-Q1-REVIEW
Currency:       USD

BILLED TO:
${wei.name}
${wei.address}
Email:  ${wei.email}
Phone:  ${dotPhone(wei.phone)}
Tax ID: ${dashedSSN(wei.ssn)}

BILLED FROM:
Meridian Compliance Partners
200 Park Avenue, New York, NY 10166
billing@meridiancp.com

SERVICES RENDERED:
Q1 2024 Investment Portfolio Compliance Review
  — Full review of 38 equity and fixed-income positions across three managed funds
  — Regulatory filing support (Form ADV Amendment, Schedule 13G)
  — Risk exposure analysis and remediation recommendations report
  — Two (2) rounds of attorney review and comment

SUBTOTAL:  $12,400.00
TAX (8%):  $   992.00
TOTAL DUE: $13,392.00

PAYMENT INSTRUCTIONS:
Bank:             JPMorgan Chase
Account (masked): ****-7741
Reference:        ${wei.name.replace(' ', '_')}_Q1_2024

Late payments accrue interest at 1.5% per month.
Questions? Contact billing@meridiancp.com`,
  };

  return [h01, h02, h03, h04, h05];
}

// ─────────────────────────────────────────────────────────────
// 6.  ENTITY-ID ASSIGNMENT
//     Matches detector and recall spans back to the source entity.
// ─────────────────────────────────────────────────────────────

function assignEntityIds(spans, entity) {
  if (!entity || !entity.entityId) return;

  function normalizePhone(s) { return s.replace(/[()\s.\-]/g, ''); }

  const lastName = entity.name.split(/\s+/).pop();

  for (const span of spans) {
    if (span.type === 'SSN') {
      // Match either dashed or bare representation of the entity's SSN
      if (span.text === entity.ssn || span.text === entity.ssnBare) {
        span.entityId = `${entity.entityId}_ssn`;
      }
    } else if (span.type === 'NAME') {
      // Labeled name span captures the full name; titled span (e.g. "Mr. Smith")
      // carries the honorific + last name. Link either to the entity.
      if (span.text === entity.name || new RegExp(`\\b${lastName}\\b`).test(span.text)) {
        span.entityId = `${entity.entityId}_name`;
      }
    } else if (span.type === 'EMAIL' && span.text === entity.email) {
      span.entityId = `${entity.entityId}_email`;
    } else if (span.type === 'PHONE') {
      if (normalizePhone(span.text) === normalizePhone(entity.phone)) {
        span.entityId = `${entity.entityId}_phone`;
      }
    } else if (span.type === 'ADDRESS') {
      if (entity.address && span.text.includes(entity.address.split(',')[0])) {
        span.entityId = `${entity.entityId}_addr`;
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 7.  SINGLE-DOCUMENT PROCESSOR
//     detect → recall → tier → assign entityIds
// ─────────────────────────────────────────────────────────────

function processDoc({ id, title, category, text, entity }) {
  const detectorSpans = detect(text, id);
  const recallSpans   = recallPass(text, detectorSpans, id, detectorSpans.length);
  const allSpans      = [...detectorSpans, ...recallSpans];

  assignEntityIds(allSpans, entity);

  const { status, confidence, tierReason } = computeTier(allSpans);

  return { id, title, category, text, status, confidence, tierReason, spans: allSpans };
}

// ─────────────────────────────────────────────────────────────
// 8.  ENTITY ASSIGNMENT STRATEGY
//
//     Within each category (30 docs, 0-indexed):
//       i  0–14  → RECURRING_POOL[i % 7]  (each entity in ~2-3 docs/category = 10-15 total)
//       i 15–29  → randomly generated one-off entity
//
//     Planted miss (by global docIndex across all 150 generated docs):
//       docIndex % 10 === 0 → 'ssn'    (15 docs = 10% red)
//       docIndex % 10 === 1
//        or docIndex % 10 === 3 → 'phone' (30 docs = 20% yellow)
//       else                  → 'none'  (105 docs = 70% green)
// ─────────────────────────────────────────────────────────────

function entityForCatIndex(catIndex) {
  if (catIndex < 15) return RECURRING_POOL[catIndex % RECURRING_POOL.length];
  return makeOneOff();
}

function plantedMissForIndex(globalIndex) {
  const m = globalIndex % 10;
  if (m === 0) return 'ssn';
  if (m === 1 || m === 3) return 'phone';
  return 'none';
}

// ─────────────────────────────────────────────────────────────
// 9.  MAIN GENERATION
// ─────────────────────────────────────────────────────────────

function generate() {
  // ── Hero documents ──────────────────────────────────────
  const heroDocs = buildHeroDocs().map(processDoc);

  // ── 150 generated documents (30 per category) ───────────
  const CATEGORIES = Object.keys(TEMPLATES);
  const DOCS_PER_CAT = 30;

  const generated = [];
  let globalIndex = 0;

  for (const category of CATEGORIES) {
    for (let catIndex = 0; catIndex < DOCS_PER_CAT; catIndex++) {
      const docNum      = generated.length + 1;
      const id          = `doc_${pad(docNum, 3)}`;
      const entity      = entityForCatIndex(catIndex);
      const plantedMiss = plantedMissForIndex(globalIndex);
      const { title, text } = TEMPLATES[category](entity, plantedMiss);

      generated.push(processDoc({ id, title, category, text, entity }));
      globalIndex++;
    }
  }

  return { heroDocs, generated };
}

// ─────────────────────────────────────────────────────────────
// 10. OUTPUT
// ─────────────────────────────────────────────────────────────

const { heroDocs, generated } = generate();
const dataset = [...heroDocs, ...generated];

const heroPath    = path.join(__dirname, '../hero-docs.json');
const datasetPath = path.join(__dirname, '../dataset.json');

fs.writeFileSync(heroPath,    JSON.stringify(heroDocs, null, 2));
fs.writeFileSync(datasetPath, JSON.stringify(dataset,  null, 2));

// ── Report ───────────────────────────────────────────────────
function tally(docs) {
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const d of docs) counts[d.status]++;
  return counts;
}

const hc = tally(heroDocs);
const gc = tally(generated);
const dc = tally(dataset);

console.log(`\nHero docs (${heroDocs.length}):     green=${hc.green}  yellow=${hc.yellow}  red=${hc.red}`);
console.log(`Generated  (${generated.length}): green=${gc.green}  yellow=${gc.yellow}  red=${gc.red}`);
console.log(`─────────────────────────────────────────────────────`);
console.log(`Total      (${dataset.length}): green=${dc.green}  yellow=${dc.yellow}  red=${dc.red}`);

const pct = n => ((n / dataset.length) * 100).toFixed(1);
console.log(`Distribution: ${pct(dc.green)}% green / ${pct(dc.yellow)}% yellow / ${pct(dc.red)}% red`);

// Entity occurrence counts for the recurring pool
console.log(`\nRecurring entity appearances in generated docs:`);
for (const e of RECURRING_POOL) {
  const count = generated.reduce((n, doc) =>
    n + doc.spans.filter(s => s.entityId && s.entityId.startsWith(e.entityId)).length > 0 ? 1 : 0
  , 0);
  // Count docs that reference this entity
  const docCount = generated.filter(doc =>
    doc.spans.some(s => s.entityId && s.entityId.startsWith(e.entityId))
  ).length;
  console.log(`  ${e.entityId.padEnd(22)} → ${docCount} documents`);
}

console.log(`\n→ hero-docs.json: ${heroPath}`);
console.log(`→ dataset.json:   ${datasetPath}`);
