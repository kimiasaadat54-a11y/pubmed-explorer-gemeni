export interface JournalQualityInfo {
  tier: "Q1" | "Q2" | "Q3" | "Q4";
  tierRank: number; // 1 (Q1, highest) to 4 (Q4)
  label: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  description: string;
  peerReviewed: boolean;
}

// Q1 Flagship & High-Impact Journals (Top ~25% overall & specialty leaders)
const Q1_JOURNALS = new Set([
  "the new england journal of medicine",
  "new england journal of medicine",
  "nejm",
  "lancet (london, england)",
  "the lancet",
  "lancet",
  "jama",
  "journal of the american medical association",
  "nature medicine",
  "bmj (clinical research ed.)",
  "bmj",
  "annals of internal medicine",
  "nature",
  "cell",
  "science",
  "circulation",
  "european heart journal",
  "journal of the american college of cardiology",
  "jama cardiology",
  "jama oncology",
  "jama internal medicine",
  "jama neurology",
  "jama pediatrics",
  "jama surgery",
  "jama network open",
  "journal of clinical oncology : official journal of the american society of clinical oncology",
  "journal of clinical oncology",
  "the lancet. oncology",
  "the lancet oncology",
  "blood",
  "cancer cell",
  "nature reviews. clinical oncology",
  "nature reviews cancer",
  "the lancet. neurology",
  "the lancet neurology",
  "brain : a journal of neurology",
  "gastroenterology",
  "gut",
  "journal of hepatology",
  "kidney international",
  "american journal of respiratory and critical care medicine",
  "stroke",
  "radiology",
  "chest",
  "diabetes care",
  "the journal of urology",
  "nature immunology",
  "immunity",
  "clinical cancer research",
  "cancer research",
]);

// Q2 Leading Subspecialty Journals
const Q2_JOURNALS = new Set([
  "heart rhythm",
  "european journal of heart failure",
  "epilepsia",
  "movement disorders : official journal of the movement disorder society",
  "movement disorders",
  "multiple sclerosis (houndmills, basingstoke, england)",
  "multiple sclerosis journal",
  "the journal of bone and joint surgery. american volume",
  "the american journal of sports medicine",
  "the bone & joint journal",
  "spine",
  "pediatrics",
  "the journal of pediatrics",
  "archives of disease in childhood",
  "the journal of allergy and clinical immunology",
  "journal of immunology (baltimore, md. : 1950)",
  "journal of thoracic oncology",
  "hepatology (baltimore, md.)",
  "hepatology",
  "clinical infectious diseases : an official publication of the infectious diseases society of america",
  "clinical infectious diseases",
  "arteriosclerosis, thrombosis, and vascular biology",
  "cardiovascular research",
  "hypertension (dallas, tex. : 1979)",
  "neuro-oncology",
  "journal of neurosurgery",
  "pain",
  "anesthesiology",
  "british journal of anaesthesia",
  "journal of the american society of nephrology : jasn",
  "journal of bone and mineral research",
  "diabetes",
  "american heart journal",
  "respirology",
  "thrombosis and haemostasis",
]);

export function getJournalQualityInfo(journalName: string | undefined | null): JournalQualityInfo {
  if (!journalName || !journalName.trim()) {
    return {
      tier: "Q4",
      tierRank: 4,
      label: "Q4 Cataloged",
      badgeBg: "bg-slate-500/20",
      badgeBorder: "border-slate-500/30",
      badgeText: "text-slate-300",
      description: "Q4 Indexing: Cataloged in PubMed.",
      peerReviewed: true,
    };
  }

  const clean = journalName.trim().toLowerCase();

  // Q1 Check
  for (const q1 of Q1_JOURNALS) {
    if (clean === q1 || clean.includes(q1) || q1.includes(clean)) {
      return {
        tier: "Q1",
        tierRank: 1,
        label: "Q1 Premier",
        badgeBg: "bg-emerald-500/20",
        badgeBorder: "border-emerald-400/40",
        badgeText: "text-emerald-300",
        description: "Q1 Flagship Journal: Top 25% High-Impact Peer-Reviewed Journal.",
        peerReviewed: true,
      };
    }
  }

  // Q2 Check
  for (const q2 of Q2_JOURNALS) {
    if (clean === q2 || clean.includes(q2) || q2.includes(clean)) {
      return {
        tier: "Q2",
        tierRank: 2,
        label: "Q2 Specialty",
        badgeBg: "bg-blue-500/20",
        badgeBorder: "border-blue-400/40",
        badgeText: "text-blue-300",
        description: "Q2 Specialty Journal: Established High-Quality Peer-Reviewed Subspecialty Journal.",
        peerReviewed: true,
      };
    }
  }

  // Q3 MEDLINE Indexed Standard
  if (clean.length > 3 && !clean.includes("case report") && !clean.includes("reports")) {
    return {
      tier: "Q3",
      tierRank: 3,
      label: "Q3 MEDLINE",
      badgeBg: "bg-indigo-500/20",
      badgeBorder: "border-indigo-400/40",
      badgeText: "text-indigo-300",
      description: "Q3 Standard Journal: Cataloged in NLM MEDLINE Peer-Reviewed Index.",
      peerReviewed: true,
    };
  }

  // Q4 PubMed Cataloged / Case Reports
  return {
    tier: "Q4",
    tierRank: 4,
    label: "Q4 Cataloged",
    badgeBg: "bg-slate-500/20",
    badgeBorder: "border-slate-500/30",
    badgeText: "text-slate-300",
    description: "Q4 General Indexing: Cataloged PubMed Record.",
    peerReviewed: true,
  };
}
