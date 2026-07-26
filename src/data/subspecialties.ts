export interface Subspecialty {
  key: string;
  label: string;
  query: string;
}

export interface MedicalField {
  key: string;
  label: string;
  accent: string;
  subspecialties: Subspecialty[];
}

// Scientific Taxonomy based on NLM MeSH Tree Categories & ACGME Recognized Specialties
export const FIELDS: MedicalField[] = [
  {
    key: "cardiology",
    label: "Cardiovascular Medicine",
    accent: "#3b82f6",
    subspecialties: [
      { key: "interventional", label: "Interventional Cardiology", query: '(interventional cardiology[Title/Abstract] OR "percutaneous coronary intervention"[MeSH Terms] OR angioplasty[Title/Abstract])' },
      { key: "ep", label: "Electrophysiology & Arrhythmias", query: '(electrophysiology[Title/Abstract] OR "arrhythmias, cardiac"[MeSH Terms] OR ablation[Title/Abstract])' },
      { key: "heartfailure", label: "Heart Failure & Transplantation", query: '("heart failure"[MeSH Terms] OR "heart transplantation"[MeSH Terms])' },
      { key: "achd", label: "Adult Congenital Heart Disease", query: '("heart defects, congenital"[MeSH Terms] AND adult[Title/Abstract])' },
      { key: "imaging", label: "Cardiovascular Imaging (Echo/CT/MRI)", query: '(echocardiography[MeSH Terms] OR "cardiac MRI"[Title/Abstract] OR "cardiac CT"[Title/Abstract])' },
      { key: "preventive", label: "Preventive & Cardiometabolic", query: '("cardiovascular diseases/prevention and control"[MeSH Terms] OR cardiometabolic[Title/Abstract])' },
      { key: "structural", label: "Structural Heart & TAVR", query: '("structural heart disease"[Title/Abstract] OR TAVR[Title/Abstract] OR "heart valve prosthesis"[MeSH Terms])' },
      { key: "pulmhtn", label: "Pulmonary Hypertension", query: '"hypertension, pulmonary"[MeSH Terms]' },
      { key: "cardioonc", label: "Cardio-Oncology", query: '(cardio-oncology[Title/Abstract] OR "cardiotoxicity"[Title/Abstract])' },
      { key: "vascular_med", label: "Vascular Medicine", query: '"vascular diseases"[MeSH Terms]' },
    ],
  },
  {
    key: "oncology",
    label: "Oncology & Hematology",
    accent: "#a855f7",
    subspecialties: [
      { key: "medonc", label: "Medical Oncology", query: '"medical oncology"[MeSH Terms]' },
      { key: "surgonc", label: "Surgical Oncology", query: '"surgical oncology"[Title/Abstract]' },
      { key: "radonc", label: "Radiation Oncology", query: '"radiotherapy"[MeSH Terms]' },
      { key: "hemeonc", label: "Hematologic Malignancies", query: '("leukemia"[MeSH Terms] OR "lymphoma"[MeSH Terms] OR "multiple myeloma"[MeSH Terms])' },
      { key: "breast", label: "Breast Cancer", query: '"breast neoplasms"[MeSH Terms]' },
      { key: "gi", label: "Gastrointestinal & Colorectal Cancer", query: '("colorectal neoplasms"[MeSH Terms] OR "gastrointestinal neoplasms"[MeSH Terms])' },
      { key: "thoracic", label: "Thoracic / Lung Cancer", query: '"lung neoplasms"[MeSH Terms]' },
      { key: "gu", label: "Genitourinary Cancer", query: '("prostatic neoplasms"[MeSH Terms] OR "urologic neoplasms"[MeSH Terms])' },
      { key: "gyn", label: "Gynecologic Oncology", query: '"genital neoplasms, female"[MeSH Terms]' },
      { key: "immunoonc", label: "Immuno-Oncology & Cell Therapy", query: '(immunotherapy[Title/Abstract] AND neoplasms[Title/Abstract] OR "CAR-T"[Title/Abstract])' },
      { key: "neuroonc", label: "Neuro-Oncology", query: '"brain neoplasms"[MeSH Terms]' },
      { key: "sarcoma", label: "Sarcoma & Bone Tumors", query: '"sarcoma"[MeSH Terms]' },
      { key: "palliative", label: "Palliative & Supportive Oncology", query: '("palliative care"[MeSH Terms] AND cancer[Title/Abstract])' },
    ],
  },
  {
    key: "neurology",
    label: "Neurology & Neurosurgery",
    accent: "#06b6d4",
    subspecialties: [
      { key: "stroke", label: "Vascular Neurology / Stroke", query: '"stroke"[MeSH Terms]' },
      { key: "epilepsy", label: "Epilepsy & Seizures", query: '"epilepsy"[MeSH Terms]' },
      { key: "movement", label: "Movement Disorders & Parkinson's", query: '("parkinson disease"[MeSH Terms] OR "movement disorders"[MeSH Terms])' },
      { key: "neuromuscular", label: "Neuromuscular & ALS", query: '"neuromuscular diseases"[MeSH Terms]' },
      { key: "headache", label: "Headache Medicine & Migraine", query: '"headache disorders"[MeSH Terms]' },
      { key: "ms", label: "Multiple Sclerosis & Neuroimmunology", query: '"multiple sclerosis"[MeSH Terms]' },
      { key: "neurocrit", label: "Neurocritical Care", query: '"neurocritical care"[Title/Abstract]' },
      { key: "dementia", label: "Cognitive Neurology & Alzheimer's", query: '("dementia"[MeSH Terms] OR "alzheimer disease"[MeSH Terms])' },
      { key: "neurosurg", label: "Operative Neurosurgery", query: '"neurosurgery"[MeSH Terms]' },
      { key: "sleep", label: "Sleep Medicine & Neurology", query: '"sleep wake disorders"[MeSH Terms]' },
    ],
  },
  {
    key: "internal_medicine",
    label: "Internal Medicine Subspecialties",
    accent: "#10b981",
    subspecialties: [
      { key: "gi_hepatology", label: "Gastroenterology & Hepatology", query: '("gastrointestinal diseases"[MeSH Terms] OR "liver diseases"[MeSH Terms])' },
      { key: "pulm_crit", label: "Pulmonology & Critical Care", query: '("respiratory tract diseases"[MeSH Terms] OR "critical care"[MeSH Terms])' },
      { key: "endocrinology", label: "Endocrinology & Diabetes", query: '("endocrine system diseases"[MeSH Terms] OR "diabetes mellitus"[MeSH Terms])' },
      { key: "nephrology", label: "Nephrology & Hypertension", query: '("kidney diseases"[MeSH Terms] OR "hypertension"[MeSH Terms])' },
      { key: "rheumatology", label: "Rheumatology & Autoimmune", query: '("rheumatic diseases"[MeSH Terms] OR "autoimmune diseases"[MeSH Terms])' },
      { key: "infectious", label: "Infectious Diseases & Virology", query: '("communicable diseases"[MeSH Terms] OR "anti-infective agents"[MeSH Terms])' },
      { key: "geriatrics", label: "Geriatric Medicine", query: '"geriatrics"[MeSH Terms]' },
      { key: "allergy_imm", label: "Allergy & Clinical Immunology", query: '"hypersensitivity"[MeSH Terms]' },
    ],
  },
  {
    key: "surgery",
    label: "Surgery & Specialties",
    accent: "#f59e0b",
    subspecialties: [
      { key: "gensurg", label: "General & Minimally Invasive Surgery", query: '("general surgery"[Title/Abstract] OR "laparoscopy"[MeSH Terms])' },
      { key: "ct_surg", label: "Cardiothoracic Surgery", query: '("thoracic surgery"[MeSH Terms] OR "cardiac surgical procedures"[MeSH Terms])' },
      { key: "vascular_surg", label: "Vascular Surgery", query: '"vascular surgical procedures"[MeSH Terms]' },
      { key: "urology", label: "Urology & Endourology", query: '"urology"[MeSH Terms]' },
      { key: "plastics", label: "Plastic & Reconstructive Surgery", query: '"surgery, plastic"[MeSH Terms]' },
      { key: "trauma_surg", label: "Trauma & Surgical Critical Care", query: '("trauma centers"[MeSH Terms] OR "surgical critical care"[Title/Abstract])' },
      { key: "transplant_surg", label: "Transplant Surgery", query: '"organ transplantation"[MeSH Terms]' },
    ],
  },
  {
    key: "orthopedics",
    label: "Orthopedics & Sports Medicine",
    accent: "#d97706",
    subspecialties: [
      { key: "sportsmed", label: "Sports Medicine & Arthroscopy", query: '"athletic injuries"[MeSH Terms]' },
      { key: "joint", label: "Joint Reconstruction (Hip & Knee)", query: '("arthroplasty, replacement, hip"[MeSH Terms] OR "arthroplasty, replacement, knee"[MeSH Terms])' },
      { key: "spine", label: "Spine Surgery & Disorders", query: '"spinal fusion"[MeSH Terms]' },
      { key: "hand", label: "Hand & Upper Extremity", query: '"hand injuries"[MeSH Terms]' },
      { key: "footankle", label: "Foot & Ankle Surgery", query: '("foot injuries"[MeSH Terms] OR "ankle injuries"[MeSH Terms])' },
      { key: "orthotrauma", label: "Orthopedic Trauma & Fractures", query: '"fractures, bone"[MeSH Terms]' },
      { key: "pedsortho", label: "Pediatric Orthopedics", query: '(orthopedics[Title/Abstract] AND pediatric[Title/Abstract])' },
    ],
  },
  {
    key: "pediatrics",
    label: "Pediatrics & Neonatology",
    accent: "#ec4899",
    subspecialties: [
      { key: "neonatology", label: "Neonatal-Perinatal Medicine", query: '"infant, newborn"[MeSH Terms]' },
      { key: "pedcardio", label: "Pediatric Cardiology", query: '(pediatric[Title/Abstract] AND "heart diseases"[MeSH Terms])' },
      { key: "pedonc", label: "Pediatric Hematology-Oncology", query: '(pediatric[Title/Abstract] AND neoplasms[Title/Abstract])' },
      { key: "pedcc", label: "Pediatric Critical Care (PICU)", query: '(pediatric[Title/Abstract] AND "critical care"[MeSH Terms])' },
      { key: "pedid", label: "Pediatric Infectious Disease", query: '(pediatric[Title/Abstract] AND "communicable diseases"[MeSH Terms])' },
      { key: "pedpulm", label: "Pediatric Pulmonology & Cystic Fibrosis", query: '(pediatric[Title/Abstract] AND "respiratory tract diseases"[MeSH Terms])' },
      { key: "pedendo", label: "Pediatric Endocrinology", query: '(pediatric[Title/Abstract] AND "endocrine system diseases"[MeSH Terms])' },
      { key: "devbehav", label: "Developmental & Behavioral Pediatrics", query: '"child development"[MeSH Terms]' },
    ],
  },
  {
    key: "psychiatry",
    label: "Psychiatry & Behavioral Health",
    accent: "#8b5cf6",
    subspecialties: [
      { key: "genpsych", label: "General & Adult Psychiatry", query: '"psychiatry"[MeSH Terms]' },
      { key: "childpsych", label: "Child & Adolescent Psychiatry", query: '"adolescent psychiatry"[MeSH Terms]' },
      { key: "addiction", label: "Addiction Psychiatry & Medicine", query: '"substance-related disorders"[MeSH Terms]' },
      { key: "neuropsych", label: "Neuropsychiatry & Behavioral Neurology", query: '"neuropsychiatry"[MeSH Terms]' },
      { key: "geripsych", label: "Geriatric Psychiatry", query: '"geriatric psychiatry"[MeSH Terms]' },
      { key: "psychotherapy", label: "Interventional & Somatic Psychiatry", query: '("electroconvulsive therapy"[MeSH Terms] OR "transcranial magnetic stimulation"[MeSH Terms])' },
    ],
  },
  {
    key: "emergency",
    label: "Emergency & Critical Care",
    accent: "#ef4444",
    subspecialties: [
      { key: "resuscitation", label: "Resuscitation & Shock", query: '("resuscitation"[MeSH Terms] OR "shock"[MeSH Terms])' },
      { key: "criticalcare", label: "Medical Critical Care & ICU", query: '"intensive care units"[MeSH Terms]' },
      { key: "toxicology", label: "Medical Toxicology", query: '"toxicology"[MeSH Terms]' },
      { key: "ems", label: "Prehospital & EMS Medicine", query: '"emergency medical services"[MeSH Terms]' },
      { key: "pedem", label: "Pediatric Emergency Medicine", query: '(pediatric[Title/Abstract] AND "emergency medicine"[MeSH Terms])' },
    ],
  },
  {
    key: "radiology",
    label: "Radiology & Nuclear Medicine",
    accent: "#6366f1",
    subspecialties: [
      { key: "diagrad", label: "Diagnostic Radiology & AI Imaging", query: '("diagnostic imaging"[MeSH Terms] OR "artificial intelligence"[MeSH Terms] AND radiology)' },
      { key: "ir", label: "Interventional Radiology", query: '"radiology, interventional"[MeSH Terms]' },
      { key: "neurorad", label: "Neuroradiology", query: '"neuroradiology"[MeSH Terms]' },
      { key: "nucmed", label: "Nuclear Medicine & Molecular PET", query: '("nuclear medicine"[MeSH Terms] OR "positron-emission tomography"[MeSH Terms])' },
      { key: "abdomrad", label: "Abdominal & Body Imaging", query: '"radiology"[MeSH Terms] AND abdomen' },
    ],
  },
  {
    key: "obgyn",
    label: "Obstetrics & Gynecology",
    accent: "#f43f5e",
    subspecialties: [
      { key: "mfm", label: "Maternal-Fetal Medicine (High-Risk OB)", query: '"maternal-fetal medicine"[MeSH Terms]' },
      { key: "rei", label: "Reproductive Endocrinology & IVF", query: '("reproductive medicine"[MeSH Terms] OR "fertilization in vitro"[MeSH Terms])' },
      { key: "gynonc", label: "Gynecologic Oncology", query: '"genital neoplasms, female"[MeSH Terms]' },
      { key: "urogyn", label: "Female Pelvic Medicine & Reconstructive", query: '"pelvic organ prolapse"[MeSH Terms]' },
    ],
  },
  {
    key: "derm_ophth",
    label: "Dermatology & Ophthalmology",
    accent: "#14b8a6",
    subspecialties: [
      { key: "derm", label: "Medical Dermatology", query: '"dermatology"[MeSH Terms]' },
      { key: "dermsurg", label: "Dermatologic & Mohs Surgery", query: '("mohs surgery"[MeSH Terms] OR "dermatologic surgical procedures"[MeSH Terms])' },
      { key: "cornea", label: "Cornea & Refractive Surgery", query: '"cornea"[MeSH Terms]' },
      { key: "retina", label: "Vitreoretinal Diseases", query: '"retinal diseases"[MeSH Terms]' },
      { key: "glaucoma", label: "Glaucoma & Intraocular Pressure", query: '"glaucoma"[MeSH Terms]' },
    ],
  },
];
