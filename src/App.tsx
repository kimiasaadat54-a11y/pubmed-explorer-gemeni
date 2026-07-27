import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search,
  Activity,
  ChevronDown,
  ChevronUp,
  Loader2,
  ExternalLink,
  Calendar,
  X,
  BookOpen,
  Download,
  Copy,
  Check,
  Tag,
  BarChart2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  ShieldCheck,
  Network,
  Filter,
  ListOrdered,
  BookOpenCheck,
  FileText,
  FlaskConical
} from "lucide-react";
import { FIELDS, MedicalField, Subspecialty } from "./data/subspecialties";
import { getJournalQualityInfo, JournalQualityInfo } from "./data/journalMetrics";
import { MeshCooccurrenceGraph } from "./components/MeshCooccurrenceGraph";
import { RankedMeshList } from "./components/RankedMeshList";

// Interface Definitions
export interface Article {
  pmid: string;
  title: string;
  journal: string;
  year: string;
  pubDate: string;
  doi: string;
  abstract: string;
  meshTerms: string[];
  majorMeshTerms: string[];
  authors: string;
  publicationTypes: string[];
  primaryPublicationType: string;
  citationCount: number | null;
  rcr: number | null;
  journalQuality: JournalQualityInfo;
}

export interface DateFilter {
  mindate: string; // YYYY/MM/DD
  maxdate: string; // YYYY/MM/DD
  label: string;
}

export interface TrendPeriod {
  label: string;
  mindate: string;
  maxdate: string;
  count: number | null;
}

export interface PaperTypeFilterOption {
  key: string;
  label: string;
  pubmedQuery: string | null;
  badgeColor: string;
}

export const PAPER_TYPE_OPTIONS: PaperTypeFilterOption[] = [
  { key: "all", label: "All Paper Types", pubmedQuery: null, badgeColor: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  { key: "clinical_trial", label: "Clinical Trial", pubmedQuery: '"Clinical Trial"[pt] OR "Controlled Clinical Trial"[pt]', badgeColor: "bg-teal-500/20 text-teal-300 border-teal-400/30" },
  { key: "rct", label: "Randomized Controlled Trial (RCT)", pubmedQuery: '"Randomized Controlled Trial"[pt]', badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30" },
  { key: "review", label: "Review", pubmedQuery: '"Review"[pt]', badgeColor: "bg-blue-500/20 text-blue-300 border-blue-400/30" },
  { key: "systematic_review", label: "Systematic Review", pubmedQuery: '"Systematic Review"[pt]', badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30" },
  { key: "meta_analysis", label: "Meta-Analysis", pubmedQuery: '"Meta-Analysis"[pt]', badgeColor: "bg-purple-500/20 text-purple-300 border-purple-400/30" },
  { key: "case_reports", label: "Case Report", pubmedQuery: '"Case Reports"[pt]', badgeColor: "bg-amber-500/20 text-amber-300 border-amber-400/30" },
  { key: "observational", label: "Observational Study", pubmedQuery: '"Observational Study"[pt]', badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30" },
  { key: "original", label: "Original Article", pubmedQuery: '"Journal Article"[pt]', badgeColor: "bg-slate-500/20 text-slate-300 border-slate-400/30" },
];

export function determinePrimaryPaperType(pubTypes: string[]): string {
  if (!pubTypes || pubTypes.length === 0) return "Original Article";
  const typesLower = pubTypes.map((t) => t.toLowerCase());

  if (typesLower.some((t) => t.includes("meta-analysis"))) return "Meta-Analysis";
  if (typesLower.some((t) => t.includes("systematic review"))) return "Systematic Review";
  if (typesLower.some((t) => t.includes("randomized controlled trial"))) return "Randomized Controlled Trial";
  if (typesLower.some((t) => t.includes("clinical trial") || t.includes("controlled clinical trial"))) return "Clinical Trial";
  if (typesLower.some((t) => t.includes("review"))) return "Review";
  if (typesLower.some((t) => t.includes("case report"))) return "Case Report";
  if (typesLower.some((t) => t.includes("observational study") || t.includes("comparative study") || t.includes("multicenter study"))) return "Observational Study";
  if (typesLower.some((t) => t.includes("editorial") || t.includes("letter") || t.includes("comment"))) return "Editorial / Comment";
  if (typesLower.some((t) => t.includes("practice guideline") || t.includes("guideline"))) return "Guideline";

  const nonGeneric = pubTypes.find((t) => t.toLowerCase() !== "journal article");
  if (nonGeneric) return nonGeneric;

  return "Original Article";
}

export function getPaperTypeBadgeStyle(paperType: string): string {
  const t = paperType.toLowerCase();
  if (t.includes("meta-analysis")) return "bg-purple-500/20 text-purple-300 border-purple-400/30";
  if (t.includes("systematic review")) return "bg-indigo-500/20 text-indigo-300 border-indigo-400/30";
  if (t.includes("randomized")) return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  if (t.includes("clinical trial")) return "bg-teal-500/20 text-teal-300 border-teal-400/30";
  if (t.includes("review")) return "bg-blue-500/20 text-blue-300 border-blue-400/30";
  if (t.includes("observational") || t.includes("comparative")) return "bg-cyan-500/20 text-cyan-300 border-cyan-400/30";
  if (t.includes("case report")) return "bg-amber-500/20 text-amber-300 border-amber-400/30";
  if (t.includes("editorial") || t.includes("letter") || t.includes("comment")) return "bg-rose-500/20 text-rose-300 border-rose-400/30";
  return "bg-slate-500/20 text-slate-300 border-slate-400/30";
}

const STOPWORDS = new Set([
  "and", "the", "for", "with", "human", "humans", "male", "female",
  "adult", "middle aged", "aged", "young adult", "child", "infant",
  "animals", "mice", "rats", "study", "studies", "article", "journal"
]);

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function lastTwoYearsFilter(): DateFilter {
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  return { mindate: fmtDate(twoYearsAgo), maxdate: fmtDate(now), label: "Last 2 years" };
}

async function fetchWithRetry<T = any>(url: string, attempts = 3, parseAs: "json" | "text" = "json"): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseAs === "text" ? ((await res.text()) as unknown as T) : await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function parseArticleXML(xmlText: string): Omit<Article, "citationCount" | "rcr" | "journalQuality">[] {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const articles = Array.from(doc.querySelectorAll("PubmedArticle"));

  return articles.map((art) => {
    const pmid = art.querySelector("MedlineCitation > PMID")?.textContent || art.querySelector("PMID")?.textContent || "";
    const title = (art.querySelector("ArticleTitle")?.textContent || "Untitled").replace(/\.$/, "");
    const journal = art.querySelector("Journal Title")?.textContent
      || art.querySelector("MedlineJournalInfo MedlineTA")?.textContent
      || art.querySelector("Journal > Title")?.textContent
      || "";

    let year = art.querySelector("JournalIssue > PubDate > Year")?.textContent || art.querySelector("PubDate > Year")?.textContent;
    if (!year) {
      const medlineDate = art.querySelector("PubDate > MedlineDate")?.textContent || "";
      const match = medlineDate.match(/\d{4}/);
      year = match ? match[0] : "";
    }

    const pubDate = art.querySelector("PubDate > MedlineDate")?.textContent || year || "";

    // DOI
    const doi = art.querySelector('ArticleId[IdType="doi"]')?.textContent || "";

    // Abstract text
    const abstractTexts = Array.from(art.querySelectorAll("AbstractText"));
    const abstract = abstractTexts.map(a => {
      const label = a.getAttribute("Label");
      return label ? `${label}: ${a.textContent}` : a.textContent;
    }).join("\n\n") || "No abstract available.";

    // Publication Types
    const pubTypeEls = Array.from(art.querySelectorAll("PublicationTypeList > PublicationType"));
    const publicationTypes = pubTypeEls.map((pt) => pt.textContent?.trim()).filter(Boolean) as string[];
    const primaryPublicationType = determinePrimaryPaperType(publicationTypes);

    // MeSH Terms
    const meshHeadings = Array.from(art.querySelectorAll("MeshHeading"));
    const meshTerms: string[] = [];
    const majorMeshTerms: string[] = [];

    meshHeadings.forEach((mh) => {
      const desc = mh.querySelector("DescriptorName");
      if (desc && desc.textContent) {
        const name = desc.textContent;
        meshTerms.push(name);
        if (desc.getAttribute("MajorTopicYN") === "Y") {
          majorMeshTerms.push(name);
        }
      }
    });

    // Authors
    const authorList = Array.from(art.querySelectorAll("AuthorList > Author")).slice(0, 4).map((a) => {
      const last = a.querySelector("LastName")?.textContent || "";
      const initials = a.querySelector("Initials")?.textContent || "";
      const fore = a.querySelector("ForeName")?.textContent || "";
      return last ? `${last} ${initials || fore}` : "";
    }).filter(Boolean);

    const authorStr = authorList.join(", ") + (art.querySelectorAll("AuthorList > Author").length > 4 ? " et al." : "");

    return {
      pmid,
      title,
      journal,
      year: year || "",
      pubDate,
      doi,
      abstract,
      publicationTypes,
      primaryPublicationType,
      meshTerms,
      majorMeshTerms: majorMeshTerms.length > 0 ? majorMeshTerms : meshTerms.slice(0, 3),
      authors: authorStr || "Unknown authors"
    };
  });
}

// Fetch citation metadata from NIH iCite API
async function fetchICiteMetrics(pmids: string[]): Promise<Map<string, { citationCount: number | null; rcr: number | null }>> {
  const map = new Map<string, { citationCount: number | null; rcr: number | null }>();
  if (!pmids.length) return map;

  try {
    const url = `https://icite.od.nih.gov/api/pubs?pmids=${pmids.join(",")}`;
    const data = await fetchWithRetry<any>(url, 2);
    if (data?.data && Array.isArray(data.data)) {
      data.data.forEach((item: any) => {
        if (item.pmid) {
          map.set(String(item.pmid), {
            citationCount: typeof item.citation_count === "number" ? item.citation_count : null,
            rcr: typeof item.relative_citation_ratio === "number" ? item.relative_citation_ratio : null
          });
        }
      });
    }
  } catch (e) {
    console.warn("iCite API call failed:", e);
  }
  return map;
}

function extractMeshFrequency(allMeshLists: string[][]): [string, number][] {
  const freq: Record<string, { display: string; count: number }> = {};
  allMeshLists.forEach((list) => {
    const seenInDoc = new Set<string>();
    list.forEach((term) => {
      const lower = term.toLowerCase();
      if (seenInDoc.has(lower) || STOPWORDS.has(lower)) return;
      seenInDoc.add(lower);
      if (!freq[lower]) {
        freq[lower] = { display: term, count: 0 };
      }
      freq[lower].count += 1;
    });
  });

  return Object.values(freq)
    .sort((a, b) => b.count - a.count)
    .map((item) => [item.display, item.count]);
}

function getLastSixMonthsRange() {
  const now = new Date();
  const maxdate = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
  const past = new Date();
  past.setMonth(past.getMonth() - 6);
  const mindate = `${past.getFullYear()}/${pad(past.getMonth() + 1)}/${pad(past.getDate())}`;
  return { mindate, maxdate, label: "Last 6 Months" };
}

function getLastXYearsRange(years: number) {
  const now = new Date();
  const maxdate = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`;
  const past = new Date();
  past.setFullYear(past.getFullYear() - years);
  const mindate = `${past.getFullYear()}/${pad(past.getMonth() + 1)}/${pad(past.getDate())}`;
  return { mindate, maxdate, label: `Last ${years} Year${years > 1 ? "s" : ""}` };
}

function buildPeriods(mode: "yearly" | "monthly"): TrendPeriod[] {
  const now = new Date();
  const periods: TrendPeriod[] = [];
  if (mode === "yearly") {
    for (let i = 9; i >= 0; i--) {
      const year = now.getFullYear() - i;
      periods.push({ label: String(year), mindate: `${year}/01/01`, maxdate: `${year}/12/31`, count: null });
    }
  } else {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const mm = pad(month + 1);
      periods.push({
        label: `${monthNames[month]} ${String(year).slice(2)}`,
        mindate: `${year}/${mm}/01`,
        maxdate: `${year}/${mm}/${pad(lastDay)}`,
        count: null
      });
    }
  }
  return periods;
}

async function fetchTrendCounts(term: string, periods: TrendPeriod[]): Promise<TrendPeriod[]> {
  const results: TrendPeriod[] = [];
  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=0&datetype=pdat&mindate=${p.mindate}&maxdate=${p.maxdate}&term=${encodeURIComponent(term)}`;
    try {
      const data = await fetchWithRetry<any>(url, 2);
      results.push({ ...p, count: Number(data?.esearchresult?.count || 0) });
    } catch (e) {
      results.push({ ...p, count: null });
    }
    if (i < periods.length - 1) await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}

// Fill-the-page tuning: how many articles to request per PubMed/iCite round trip,
// and a hard cap on how many rounds a single page-load may take (so a very strict
// filter with few matches can't spin forever).
const FILL_CHUNK_SIZE = 100;
const MAX_FILL_ATTEMPTS_PER_PAGE = 50;

// Journal Quality & Min Citations can't be expressed in the PubMed query itself,
// so this predicate is what the fill-the-page loop uses to decide whether a
// candidate article counts toward completing the requested page size.
function passesJQCitationFilter(
  a: { citationCount: number | null; journalQuality: JournalQualityInfo },
  jqFilter: "all" | "q1" | "q1q2" | "peer_reviewed",
  minCitations: number
): boolean {
  if (jqFilter === "q1" && a.journalQuality.tier !== "Q1") return false;
  if (jqFilter === "q1q2" && a.journalQuality.tier !== "Q1" && a.journalQuality.tier !== "Q2") return false;
  if (jqFilter === "peer_reviewed" && !a.journalQuality.peerReviewed) return false;
  if (minCitations > 0 && (a.citationCount ?? 0) < minCitations) return false;
  return true;
}

const COLUMNS = [
  { key: "title", label: "Article Title & Authors", sortable: false },
  { key: "paperType", label: "Paper Type", sortable: true },
  { key: "journal", label: "Journal", sortable: true },
  { key: "year", label: "Year", sortable: true },
  { key: "citations", label: "Citations & NIH RCR", sortable: true },
  { key: "journalQuality", label: "Journal Quality", sortable: true },
];

export default function App() {
  const [activeField, setActiveField] = useState<MedicalField | null>(null);
  const [activeSub, setActiveSub] = useState<Subspecialty | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [activeTerm, setActiveTerm] = useState<string | null>(null);

  // Search Results & Pagination
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [webEnv, setWebEnv] = useState<string | null>(null);
  const [queryKey, setQueryKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Sorting & Global Filters (APPLIED — these drive the actual PubMed fetch / page-fill loop)
  const [sortKey, setSortKey] = useState<string>("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeMesh, setActiveMesh] = useState<string | null>(null);
  const [paperTypeFilter, setPaperTypeFilter] = useState<string>("all");
  const [journalQualityFilter, setJournalQualityFilter] = useState<"all" | "q1" | "q1q2" | "peer_reviewed">("all");
  const [minCitationsFilter, setMinCitationsFilter] = useState<number>(0);
  const [datePreset, setDatePreset] = useState<"6m" | "1y" | "2y" | "5y" | "all" | "custom">("6m");
  const [minYearFilter, setMinYearFilter] = useState<string>("");
  const [maxYearFilter, setMaxYearFilter] = useState<string>("");
  const [meshSearchTerm, setMeshSearchTerm] = useState<string>("");
  const [meshSectionTab, setMeshSectionTab] = useState<"ranked" | "graph">("ranked");

  // Collapsible dropdown state for the Trend Chart & MeSH sections
  const [showTrendChart, setShowTrendChart] = useState<boolean>(false);
  const [showMeshSection, setShowMeshSection] = useState<boolean>(false);

  // DRAFT Filters — bound to the toolbar controls. Nothing here affects a fetch
  // until "Apply Filters" copies these into the APPLIED state above.
  const [draftPaperTypeFilter, setDraftPaperTypeFilter] = useState<string>("all");
  const [draftJournalQualityFilter, setDraftJournalQualityFilter] = useState<"all" | "q1" | "q1q2" | "peer_reviewed">("all");
  const [draftMinCitationsFilter, setDraftMinCitationsFilter] = useState<number>(0);
  const [draftDatePreset, setDraftDatePreset] = useState<"6m" | "1y" | "2y" | "5y" | "all" | "custom">("6m");
  const [draftMinYearFilter, setDraftMinYearFilter] = useState<string>("");
  const [draftMaxYearFilter, setDraftMaxYearFilter] = useState<string>("");

  // Fill-the-page pagination state. Journal Quality & Min Citations can't be
  // expressed in the PubMed query (JQ is our own list, citations come from a
  // separate iCite call) so satisfying them requires scanning forward through
  // the underlying unfiltered result set until a full page of matches is found.
  const scanCursorRef = useRef<{ retstart: number; buffer: Article[] }>({ retstart: 0, buffer: [] });
  const pageCacheRef = useRef<Map<number, { articles: Article[]; hasMore: boolean; hitCap: boolean }>>(new Map());
  const [pageHasMore, setPageHasMore] = useState<boolean>(true);
  const [pageHitCap, setPageHitCap] = useState<boolean>(false);

  // MeSH Historical Extraction State
  const [historicalMeshLists, setHistoricalMeshLists] = useState<string[][]>([]);
  const [isScanningMesh, setIsScanningMesh] = useState<boolean>(false);
  const [meshScanProgress, setMeshScanProgress] = useState<{ fetched: number; target: number } | null>(null);

  // Trend Chart State
  const [trendMode, setTrendMode] = useState<"yearly" | "monthly">("yearly");
  const [trendData, setTrendData] = useState<TrendPeriod[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Article Modal Drawer State
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [copiedPmid, setCopiedPmid] = useState<string | null>(null);

  // Interactive Bar Dragging Refs
  const [dragRange, setDragRange] = useState<{ start: number; end: number } | null>(null);
  const draggingRef = useRef(false);

  // Global PubMed Entrez query execution across ALL results
  const executePubMedSearch = useCallback(async (
    term: string,
    field: MedicalField | null,
    sub: Subspecialty | null,
    meshTerm: string | null,
    paperType: string,
    preset: "6m" | "1y" | "2y" | "5y" | "all" | "custom",
    yFrom: string,
    yTo: string,
    sKey: string,
    sDir: "asc" | "desc",
    jqFilter: "all" | "q1" | "q1q2" | "peer_reviewed",
    citFilter: number,
    page: number = 1
  ) => {
    setLoading(true);
    setError(null);
    setActiveField(field);
    setActiveSub(sub);
    setActiveTerm(term);
    setCurrentPage(page);

    // A fresh query invalidates any in-progress page-fill scan/cache.
    scanCursorRef.current = { retstart: 0, buffer: [] };
    pageCacheRef.current = new Map();
    setPageHasMore(true);
    setPageHitCap(false);

    // Build composite term query for NCBI PubMed esearch
    let compositeTerm = term;

    if (meshTerm) {
      compositeTerm += ` AND "${meshTerm}"[Mesh]`;
    }

    const selectedOption = PAPER_TYPE_OPTIONS.find((p) => p.key === paperType);
    if (selectedOption && selectedOption.pubmedQuery) {
      compositeTerm += ` AND (${selectedOption.pubmedQuery})`;
    }

    let dateParams = "";
    if (preset === "6m") {
      const range = getLastSixMonthsRange();
      dateParams = `&datetype=pdat&mindate=${range.mindate}&maxdate=${range.maxdate}`;
    } else if (preset === "1y") {
      const range = getLastXYearsRange(1);
      dateParams = `&datetype=pdat&mindate=${range.mindate}&maxdate=${range.maxdate}`;
    } else if (preset === "2y") {
      const range = getLastXYearsRange(2);
      dateParams = `&datetype=pdat&mindate=${range.mindate}&maxdate=${range.maxdate}`;
    } else if (preset === "5y") {
      const range = getLastXYearsRange(5);
      dateParams = `&datetype=pdat&mindate=${range.mindate}&maxdate=${range.maxdate}`;
    } else if (preset === "custom" || yFrom || yTo) {
      if (yFrom || yTo) {
        const minD = yFrom ? (yFrom.includes("/") ? yFrom : `${yFrom}/01/01`) : "1900/01/01";
        const maxD = yTo ? (yTo.includes("/") ? yTo : `${yTo}/12/31`) : `${new Date().getFullYear()}/12/31`;
        dateParams = `&datetype=pdat&mindate=${minD}&maxdate=${maxD}`;
      }
    }

    let pubmedSort = "date";
    if (sKey === "year") {
      pubmedSort = sDir === "asc" ? "pub_date" : "date";
    } else if (sKey === "journal") {
      pubmedSort = "journal";
    }

    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&usehistory=y&sort=${pubmedSort}${dateParams}&term=${encodeURIComponent(compositeTerm)}`;

    try {
      const esearchData = await fetchWithRetry<any>(esearchUrl);
      const total = parseInt(esearchData?.esearchresult?.count || "0", 10);
      const env = esearchData?.esearchresult?.webenv || null;
      const key = esearchData?.esearchresult?.querykey || null;

      setTotalCount(total);
      setWebEnv(env);
      setQueryKey(key);

      if (total === 0 || !env || !key) {
        setArticles([]);
        setLoading(false);
        return;
      }

      await fetchArticlePage(page, pageSize, env, key, total, jqFilter, citFilter);
    } catch (e) {
      console.error("PubMed search error:", e);
      setError("Unable to connect to PubMed. Please check your connection or try again.");
      setArticles([]);
      setTotalCount(0);
      setWebEnv(null);
      setQueryKey(null);
      setLoading(false);
    }
  }, [pageSize]);

  // Fetch + parse one chunk of PubMed records starting at `retstart`, attach iCite
  // citation metrics, and return the fully-built Article objects. Shared by both
  // the fast unfiltered path and the fill-the-page loop below.
  const fetchArticleChunk = async (
    env: string,
    key: string,
    retstart: number,
    retmax: number
  ): Promise<Article[]> => {
    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&query_key=${key}&WebEnv=${env}&retstart=${retstart}&retmax=${retmax}`;
    const xmlText = await fetchWithRetry<string>(efetchUrl, 3, "text");
    const parsedArticles = parseArticleXML(xmlText);

    const pmids = parsedArticles.map((a) => a.pmid).filter(Boolean);
    const iciteMetrics = await fetchICiteMetrics(pmids);

    const completeArticles: Article[] = parsedArticles.map((a) => {
      const jQuality = getJournalQualityInfo(a.journal);
      const citeData = iciteMetrics.get(a.pmid);
      return {
        ...a,
        citationCount: citeData?.citationCount ?? null,
        rcr: citeData?.rcr ?? null,
        journalQuality: jQuality,
      };
    });

    // Every article scanned (whether it ends up passing JQ/citation filters or
    // not) contributes to the MeSH intelligence corpus — that section reflects
    // the whole topic, not just what happens to be on the current page.
    const newMeshLists = parsedArticles.map((a) => a.meshTerms);
    setHistoricalMeshLists((prev) => [...prev, ...newMeshLists]);

    return completeArticles;
  };

  // Fetch a page of articles using Entrez History WebEnv & query_key.
  // - When Journal Quality / Min Citations filters are OFF, this is a single
  //   direct fetch at retstart=(page-1)*size — exact, cheap, unchanged from before.
  // - When either filter is ON, PubMed can't apply them for us, so this scans
  //   forward in chunks — carrying a cursor + leftover-match buffer across page
  //   turns — until the page is full or the whole result set is exhausted.
  const fetchArticlePage = async (
    page: number,
    size: number,
    env: string,
    key: string,
    total: number,
    jqFilter: "all" | "q1" | "q1q2" | "peer_reviewed",
    citFilter: number
  ) => {
    const fillModeActive = jqFilter !== "all" || citFilter > 0;

    setLoading(true);
    setError(null);

    try {
      if (!fillModeActive) {
        const retstart = (page - 1) * size;
        const chunk = await fetchArticleChunk(env, key, retstart, size);
        setArticles(chunk);
        setCurrentPage(page);
        setPageHasMore(retstart + size < total);
        setPageHitCap(false);
        return;
      }

      // Filtered ("fill the page") mode.
      const cached = pageCacheRef.current.get(page);
      if (cached) {
        setArticles(cached.articles);
        setCurrentPage(page);
        setPageHasMore(cached.hasMore);
        setPageHitCap(cached.hitCap);
        return;
      }

      let { retstart, buffer } = scanCursorRef.current;
      let attempts = 0;
      let exhausted = retstart >= total;

      while (buffer.length < size && attempts < MAX_FILL_ATTEMPTS_PER_PAGE && retstart < total) {
        const retmax = Math.min(FILL_CHUNK_SIZE, total - retstart);
        const chunk = await fetchArticleChunk(env, key, retstart, retmax);
        buffer = [...buffer, ...chunk.filter((a) => passesJQCitationFilter(a, jqFilter, citFilter))];
        retstart += retmax;
        attempts += 1;
        if (retstart >= total) exhausted = true;
      }

      const pageArticles = buffer.slice(0, size);
      const overflow = buffer.slice(size);
      const hasMore = overflow.length > 0 || retstart < total;
      const hitCap = pageArticles.length < size && !exhausted;

      scanCursorRef.current = { retstart, buffer: overflow };
      pageCacheRef.current.set(page, { articles: pageArticles, hasMore, hitCap });

      setArticles(pageArticles);
      setCurrentPage(page);
      setPageHasMore(hasMore);
      setPageHitCap(hitCap);
    } catch (e) {
      console.error("Fetch page error:", e);
      setError("Failed to fetch article page from PubMed.");
    } finally {
      setLoading(false);
    }
  };

  // Process All / Extensive Historical MeSH Terms
  const scanHistoricalMeshTerms = async () => {
    if (!webEnv || !queryKey || totalCount === 0 || isScanningMesh) return;

    setIsScanningMesh(true);
    const chunkSize = 200;
    // Scan up to min(totalCount, 1600) articles for full historical MeSH trends
    const scanTarget = Math.min(totalCount, 1600);
    let allExtractedMesh: string[][] = [...historicalMeshLists];

    setMeshScanProgress({ fetched: historicalMeshLists.length, target: scanTarget });

    try {
      for (let retstart = historicalMeshLists.length; retstart < scanTarget; retstart += chunkSize) {
        const retmax = Math.min(chunkSize, scanTarget - retstart);
        const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&query_key=${queryKey}&WebEnv=${webEnv}&retstart=${retstart}&retmax=${retmax}`;

        const xmlText = await fetchWithRetry<string>(efetchUrl, 2, "text");
        const parsed = parseArticleXML(xmlText);
        const chunkMeshLists = parsed.map(a => a.meshTerms);

        allExtractedMesh = [...allExtractedMesh, ...chunkMeshLists];
        setHistoricalMeshLists(allExtractedMesh);
        setMeshScanProgress({ fetched: allExtractedMesh.length, target: scanTarget });

        // Gentle pause between NCBI API requests
        await new Promise(r => setTimeout(r, 250));
      }
    } catch (e) {
      console.warn("Historical MeSH scan completed with partial results:", e);
    } finally {
      setIsScanningMesh(false);
      setMeshScanProgress(null);
    }
  };

  // Whether the fill-the-page loop is needed at all (JQ / Min Citations active).
  const fillModeActive = journalQualityFilter !== "all" || minCitationsFilter > 0;

  // Page Navigation Handlers
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage === currentPage || !webEnv || !queryKey) return;
    if (fillModeActive) {
      if (newPage > currentPage && !pageHasMore) return; // scan already exhausted
    } else {
      if (newPage > totalPages) return;
    }
    fetchArticlePage(newPage, pageSize, webEnv, queryKey, totalCount, journalQualityFilter, minCitationsFilter);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    scanCursorRef.current = { retstart: 0, buffer: [] };
    pageCacheRef.current = new Map();
    if (webEnv && queryKey && totalCount > 0) {
      fetchArticlePage(1, newSize, webEnv, queryKey, totalCount, journalQualityFilter, minCitationsFilter);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);

  // Trigger search when query term, MeSH, Paper Type, Date Preset, Year Range, JQ/Citation
  // filters, or Sorting changes across ALL data
  useEffect(() => {
    if (activeTerm) {
      executePubMedSearch(
        activeTerm,
        activeField,
        activeSub,
        activeMesh,
        paperTypeFilter,
        datePreset,
        minYearFilter,
        maxYearFilter,
        sortKey,
        sortDir,
        journalQualityFilter,
        minCitationsFilter,
        1
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTerm,
    activeMesh,
    paperTypeFilter,
    datePreset,
    minYearFilter,
    maxYearFilter,
    sortKey,
    sortDir,
    journalQualityFilter,
    minCitationsFilter,
  ]);

  // Load Trend Counts
  useEffect(() => {
    if (!activeTerm) return;
    let cancelled = false;
    setTrendLoading(true);
    const periods = buildPeriods(trendMode);
    fetchTrendCounts(activeTerm, periods).then((data) => {
      if (!cancelled) {
        setTrendData(data);
        setTrendLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [activeTerm, trendMode]);

  const selectField = (field: MedicalField) => {
    setActiveField(field);
    setActiveSub(null);
    setActiveTerm(null);
    setActiveMesh(null);
    setPaperTypeFilter("all");
    setJournalQualityFilter("all");
    setMinCitationsFilter(0);
    setDatePreset("6m");
    setMinYearFilter("");
    setMaxYearFilter("");
    setDraftPaperTypeFilter("all");
    setDraftJournalQualityFilter("all");
    setDraftMinCitationsFilter(0);
    setDraftDatePreset("6m");
    setDraftMinYearFilter("");
    setDraftMaxYearFilter("");
    setArticles([]);
    setTotalCount(0);
    setError(null);
    setTrendData([]);
    setHistoricalMeshLists([]);
  };

  const handleSelectSubspecialty = (sub: Subspecialty) => {
    setActiveMesh(null);
    setPaperTypeFilter("all");
    setJournalQualityFilter("all");
    setMinCitationsFilter(0);
    setDatePreset("6m");
    setMinYearFilter("");
    setMaxYearFilter("");
    setDraftPaperTypeFilter("all");
    setDraftJournalQualityFilter("all");
    setDraftMinCitationsFilter(0);
    setDraftDatePreset("6m");
    setDraftMinYearFilter("");
    setDraftMaxYearFilter("");
    setHistoricalMeshLists([]);
    executePubMedSearch(
      sub.query,
      activeField,
      sub,
      null,
      "all",
      "6m",
      "",
      "",
      sortKey,
      sortDir,
      "all",
      0,
      1
    );
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = inputValue.trim();
    if (!term) return;
    setActiveMesh(null);
    setPaperTypeFilter("all");
    setJournalQualityFilter("all");
    setMinCitationsFilter(0);
    setDatePreset("6m");
    setMinYearFilter("");
    setMaxYearFilter("");
    setDraftPaperTypeFilter("all");
    setDraftJournalQualityFilter("all");
    setDraftMinCitationsFilter(0);
    setDraftDatePreset("6m");
    setDraftMinYearFilter("");
    setDraftMaxYearFilter("");
    setHistoricalMeshLists([]);
    executePubMedSearch(
      term,
      activeField,
      activeSub,
      null,
      "all",
      "6m",
      "",
      "",
      sortKey,
      sortDir,
      "all",
      0,
      1
    );
  };

  // Apply Filters — commits the draft toolbar state into the applied state that
  // actually drives the fetch. Nothing above this line touches the network.
  const filtersDirty =
    draftPaperTypeFilter !== paperTypeFilter ||
    draftJournalQualityFilter !== journalQualityFilter ||
    draftMinCitationsFilter !== minCitationsFilter ||
    draftDatePreset !== datePreset ||
    draftMinYearFilter !== minYearFilter ||
    draftMaxYearFilter !== maxYearFilter;

  const applyFilters = () => {
    setPaperTypeFilter(draftPaperTypeFilter);
    setJournalQualityFilter(draftJournalQualityFilter);
    setMinCitationsFilter(draftMinCitationsFilter);
    setDatePreset(draftDatePreset);
    setMinYearFilter(draftMinYearFilter);
    setMaxYearFilter(draftMaxYearFilter);
  };

  // Used by the "Active Filters" chips (below the toolbar) — removing a chip
  // there is a direct, immediate action, so it updates draft + applied together.
  const clearPaperTypeFilter = () => { setPaperTypeFilter("all"); setDraftPaperTypeFilter("all"); };
  const clearJournalQualityFilter = () => { setJournalQualityFilter("all"); setDraftJournalQualityFilter("all"); };
  const clearMinCitationsFilter = () => { setMinCitationsFilter(0); setDraftMinCitationsFilter(0); };
  const clearYearFilter = () => { setMinYearFilter(""); setMaxYearFilter(""); setDraftMinYearFilter(""); setDraftMaxYearFilter(""); };
  const clearAllFilters = () => {
    setActiveMesh(null);
    clearPaperTypeFilter();
    clearJournalQualityFilter();
    clearMinCitationsFilter();
    clearYearFilter();
  };

  // MeSH Frequency calculation across all historical extracted lists
  const meshKeywords = useMemo(() => {
    return extractMeshFrequency(historicalMeshLists);
  }, [historicalMeshLists]);

  const filteredMeshKeywords = useMemo(() => {
    if (!meshSearchTerm.trim()) return meshKeywords.slice(0, 30);
    const query = meshSearchTerm.toLowerCase();
    return meshKeywords.filter(([term]) => term.toLowerCase().includes(query)).slice(0, 30);
  }, [meshKeywords, meshSearchTerm]);

  const maxMeshCount = useMemo(() => (meshKeywords.length ? meshKeywords[0][1] : 1), [meshKeywords]);

  // Paper Type Statistics for articles currently loaded
  const paperTypeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    articles.forEach((a) => {
      const type = a.primaryPublicationType || "Original Article";
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }, [articles]);

  // Filter & Sort Articles
  const filteredArticles = useMemo(() => {
    let list = articles;
    if (activeMesh) {
      list = list.filter((a) => (a.meshTerms || []).some((t) => t.toLowerCase() === activeMesh.toLowerCase()));
    }
    if (paperTypeFilter !== "all") {
      const option = PAPER_TYPE_OPTIONS.find((p) => p.key === paperTypeFilter);
      if (option) {
        list = list.filter((a) => {
          const prim = a.primaryPublicationType.toLowerCase();
          if (paperTypeFilter === "clinical_trial") return prim.includes("clinical trial") || prim.includes("rct");
          if (paperTypeFilter === "rct") return prim.includes("randomized");
          if (paperTypeFilter === "review") return prim.includes("review");
          if (paperTypeFilter === "systematic_review") return prim.includes("systematic review");
          if (paperTypeFilter === "meta_analysis") return prim.includes("meta-analysis");
          if (paperTypeFilter === "case_reports") return prim.includes("case report");
          if (paperTypeFilter === "observational") return prim.includes("observational");
          if (paperTypeFilter === "original") return prim.includes("original") || prim.includes("article");
          return prim.includes(option.label.toLowerCase());
        });
      }
    }
    if (journalQualityFilter === "q1") {
      list = list.filter((a) => a.journalQuality.tier === "Q1");
    } else if (journalQualityFilter === "q1q2") {
      list = list.filter((a) => a.journalQuality.tier === "Q1" || a.journalQuality.tier === "Q2");
    } else if (journalQualityFilter === "peer_reviewed") {
      list = list.filter((a) => a.journalQuality.peerReviewed);
    }

    if (minCitationsFilter > 0) {
      list = list.filter((a) => (a.citationCount ?? 0) >= minCitationsFilter);
    }

    if (minYearFilter) {
      list = list.filter((a) => parseInt(a.year, 10) >= parseInt(minYearFilter, 10));
    }
    if (maxYearFilter) {
      list = list.filter((a) => parseInt(a.year, 10) <= parseInt(maxYearFilter, 10));
    }
    return list;
  }, [articles, activeMesh, paperTypeFilter, journalQualityFilter, minCitationsFilter, minYearFilter, maxYearFilter]);

  const sortedArticles = useMemo(() => {
    const arr = [...filteredArticles];
    arr.sort((a, b) => {
      let av: any = a[sortKey as keyof Article];
      let bv: any = b[sortKey as keyof Article];

      if (sortKey === "citations") {
        av = a.citationCount ?? -1;
        bv = b.citationCount ?? -1;
      } else if (sortKey === "journalQuality") {
        av = a.journalQuality.tierRank;
        bv = b.journalQuality.tierRank;
      } else if (sortKey === "paperType") {
        av = a.primaryPublicationType;
        bv = b.primaryPublicationType;
      }

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredArticles, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // Export CSV
  const exportToCSV = () => {
    if (!articles.length) return;
    const headers = ["PMID", "Title", "Paper_Type", "Publication_Types", "Journal", "Year", "Citations", "NIH_RCR", "Journal_Quality_Tier", "DOI", "Authors"];
    const rows = articles.map(a => [
      `"${a.pmid}"`,
      `"${a.title.replace(/"/g, '""')}"`,
      `"${a.primaryPublicationType}"`,
      `"${(a.publicationTypes || []).join("; ").replace(/"/g, '""')}"`,
      `"${a.journal.replace(/"/g, '""')}"`,
      `"${a.year}"`,
      a.citationCount ?? "",
      a.rcr ?? "",
      `"${a.journalQuality.label}"`,
      `"${a.doi}"`,
      `"${a.authors.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pubmed_results_${activeTerm || 'export'}_p${currentPage}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copy Citation Format
  const copyCitation = (article: Article) => {
    const citationStr = `${article.authors}. ${article.title}. ${article.journal}. ${article.year}; PMID: ${article.pmid}.`;
    navigator.clipboard.writeText(citationStr);
    setCopiedPmid(article.pmid);
    setTimeout(() => setCopiedPmid(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans relative overflow-x-hidden">
      {/* Frosted Glass Background Lighting Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/30 via-slate-900 to-emerald-900/20"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/15 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-24 -right-24 w-[32rem] h-[32rem] bg-emerald-500/10 rounded-full blur-[150px]"></div>
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-indigo-500/10 rounded-full blur-[130px]"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Header Bar with Frosted Glass Styling */}
        <header className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 border border-blue-400/30">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                      PubMed Explorer <span className="text-blue-400 font-normal text-sm">v2.1</span>
                    </h1>
                  </div>
                  <p className="text-xs text-slate-400 tracking-wider uppercase">
                    Scientific Medical Literature &amp; Journal Indexing Analyzer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="https://pubmed.ncbi.nlm.nih.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 backdrop-blur-md transition-all flex items-center gap-1.5"
                >
                  <BookOpen size={14} className="text-blue-400" /> Official PubMed <ExternalLink size={11} className="opacity-70" />
                </a>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
          {/* Medical Field Selector based on Scientific Medical Taxonomy */}
          <section className="mb-6">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Layers size={13} className="text-blue-400" /> 1. Select Medical Specialty Field ({FIELDS.length} scientific categories)
            </h2>
            <div className="flex flex-wrap gap-2.5">
              {FIELDS.map((f) => {
                const isActive = activeField?.key === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => selectField(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer border backdrop-blur-md ${
                      isActive
                        ? "bg-blue-600/80 border-blue-400/50 text-white shadow-blue-500/20"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Subspecialties & Custom Search Panel */}
          {activeField && (
            <section className="mb-8 p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
                2. Choose Subspecialty ({activeField.subspecialties.length} subfields) or Enter Custom Query
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {activeField.subspecialties.map((s) => {
                  const isActive = activeSub?.key === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => handleSelectSubspecialty(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                        isActive
                          ? "bg-blue-500/40 border-blue-400/50 text-white shadow-sm"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleCustomSearch} className="flex gap-2.5 flex-wrap items-center pt-3 border-t border-white/10">
                <div className="relative flex-1 min-w-[260px]">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Enter custom clinical term or PubMed MeSH query..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 outline-none focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20 backdrop-blur-md"
                  />
                </div>

                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/30 cursor-pointer"
                >
                  Search PubMed
                </button>
              </form>
            </section>
          )}

          {/* Empty Search Prompt */}
          {!activeTerm && (
            <div className="py-20 text-center border border-white/10 rounded-2xl bg-white/5 backdrop-blur-xl shadow-2xl">
              <Activity size={36} className="mx-auto mb-3 text-blue-400 opacity-60" />
              <p className="text-sm font-medium text-slate-300">
                {activeField ? "Select a subspecialty above to run search." : "Select a medical specialty field above to start exploring literature."}
              </p>
              <p className="text-xs mt-1 text-slate-400">
                Covers medical specialties, Journal Quality Indexing, and NIH iCite Relative Citation Ratio (RCR).
              </p>
            </div>
          )}

          {/* Search Results Dashboard */}
          {activeTerm && (
            <>
              {/* Filters & Apply */}
              <section className="mb-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                  {/* Table Control & Column Filter Toolbar */}
                  <div className="p-4 border-b border-white/10 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Paper Type Filter Dropdown */}
                      <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/15 px-3 py-1.5 rounded-xl">
                        <FileText size={14} className="text-indigo-400 shrink-0" />
                        <span className="font-bold text-slate-300">Paper Type:</span>
                        <select
                          value={draftPaperTypeFilter}
                          onChange={(e) => setDraftPaperTypeFilter(e.target.value)}
                          className="bg-transparent text-xs text-slate-200 outline-none max-w-[200px] cursor-pointer font-medium"
                        >
                          {PAPER_TYPE_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key} className="bg-slate-900 text-slate-200">
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {draftPaperTypeFilter !== "all" && (
                          <button onClick={() => setDraftPaperTypeFilter("all")} className="text-slate-400 hover:text-white ml-1 cursor-pointer">
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Journal Quality Filter Dropdown */}
                      <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/15 px-3 py-1.5 rounded-xl">
                        <ShieldCheck size={14} className="text-purple-400 shrink-0" />
                        <span className="font-bold text-slate-300">Journal Quality:</span>
                        <select
                          value={draftJournalQualityFilter}
                          onChange={(e) => setDraftJournalQualityFilter(e.target.value as any)}
                          className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium"
                        >
                          <option value="all" className="bg-slate-900 text-slate-200">All Tiers & Quality Levels</option>
                          <option value="q1" className="bg-slate-900 text-slate-200">Q1 Flagship / Top Tier</option>
                          <option value="q1q2" className="bg-slate-900 text-slate-200">Q1 & Q2 High Impact Tiers</option>
                          <option value="peer_reviewed" className="bg-slate-900 text-slate-200">Peer-Reviewed Journals</option>
                        </select>
                        {draftJournalQualityFilter !== "all" && (
                          <button onClick={() => setDraftJournalQualityFilter("all")} className="text-slate-400 hover:text-white ml-1 cursor-pointer">
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Minimum Citation Filter */}
                      <div className="flex items-center gap-2 bg-slate-900/90 border border-white/15 px-3 py-1.5 rounded-xl">
                        <BarChart2 size={14} className="text-amber-400 shrink-0" />
                        <span className="font-bold text-slate-300">Min Citations:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={draftMinCitationsFilter === 0 ? "" : draftMinCitationsFilter}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setDraftMinCitationsFilter(isNaN(val) || val < 0 ? 0 : val);
                            }}
                            className="w-16 bg-slate-800/80 border border-white/20 rounded px-2 py-0.5 text-xs text-amber-300 font-bold outline-none focus:border-amber-400 text-center"
                          />
                          <span className="text-slate-400 font-medium text-[11px]">+</span>
                        </div>
                        <div className="flex items-center gap-1 ml-1">
                          {[0, 10, 50, 100].map((preset) => (
                            <button
                              key={preset}
                              onClick={() => setDraftMinCitationsFilter(preset)}
                              className={`text-[10px] px-1.5 py-0.5 rounded transition cursor-pointer font-semibold ${
                                draftMinCitationsFilter === preset
                                  ? "bg-amber-500 text-slate-950 font-bold"
                                  : "bg-white/5 text-slate-400 hover:text-white"
                              }`}
                            >
                              {preset === 0 ? "Any" : `${preset}+`}
                            </button>
                          ))}
                        </div>
                        {draftMinCitationsFilter > 0 && (
                          <button onClick={() => setDraftMinCitationsFilter(0)} className="text-slate-400 hover:text-white ml-1 cursor-pointer">
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Year Range Column Filter */}
                      <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/15 px-3 py-1.5 rounded-xl">
                        <Calendar size={14} className="text-emerald-400 shrink-0" />
                        <span className="font-bold text-slate-300">Year Column:</span>
                        <select
                          value={draftMinYearFilter}
                          onChange={(e) => setDraftMinYearFilter(e.target.value)}
                          className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium"
                        >
                          <option value="" className="bg-slate-900 text-slate-200">From Min</option>
                          {Array.from({ length: 25 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                            <option key={y} value={y} className="bg-slate-900 text-slate-200">{y}</option>
                          ))}
                        </select>
                        <span className="text-slate-500">–</span>
                        <select
                          value={draftMaxYearFilter}
                          onChange={(e) => setDraftMaxYearFilter(e.target.value)}
                          className="bg-transparent text-xs text-slate-200 outline-none cursor-pointer font-medium"
                        >
                          <option value="" className="bg-slate-900 text-slate-200">To Max</option>
                          {Array.from({ length: 25 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                            <option key={y} value={y} className="bg-slate-900 text-slate-200">{y}</option>
                          ))}
                        </select>
                        {(draftMinYearFilter || draftMaxYearFilter) && (
                          <button onClick={() => { setDraftMinYearFilter(""); setDraftMaxYearFilter(""); }} className="text-slate-400 hover:text-white ml-1 cursor-pointer">
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Quick Time Period Presets */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setDraftDatePreset("6m");
                            setDraftMinYearFilter("");
                            setDraftMaxYearFilter("");
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            draftDatePreset === "6m" && !draftMinYearFilter && !draftMaxYearFilter
                              ? "bg-emerald-600/50 border-emerald-400/50 text-white font-bold shadow-sm"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          Last 6 Months
                        </button>
                        <button
                          onClick={() => {
                            setDraftDatePreset("1y");
                            setDraftMinYearFilter("");
                            setDraftMaxYearFilter("");
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            draftDatePreset === "1y" && !draftMinYearFilter && !draftMaxYearFilter
                              ? "bg-emerald-600/50 border-emerald-400/50 text-white font-bold shadow-sm"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          Last 1y
                        </button>
                        <button
                          onClick={() => {
                            setDraftDatePreset("2y");
                            setDraftMinYearFilter("");
                            setDraftMaxYearFilter("");
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            draftDatePreset === "2y" && !draftMinYearFilter && !draftMaxYearFilter
                              ? "bg-emerald-600/50 border-emerald-400/50 text-white font-bold shadow-sm"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          Last 2y
                        </button>
                        <button
                          onClick={() => {
                            setDraftDatePreset("5y");
                            setDraftMinYearFilter("");
                            setDraftMaxYearFilter("");
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            draftDatePreset === "5y" && !draftMinYearFilter && !draftMaxYearFilter
                              ? "bg-emerald-600/50 border-emerald-400/50 text-white font-bold shadow-sm"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          Last 5y
                        </button>
                        <button
                          onClick={() => {
                            setDraftDatePreset("all");
                            setDraftMinYearFilter("");
                            setDraftMaxYearFilter("");
                          }}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            draftDatePreset === "all" && !draftMinYearFilter && !draftMaxYearFilter
                              ? "bg-emerald-600/50 border-emerald-400/50 text-white font-bold shadow-sm"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                          }`}
                        >
                          All Time
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {filtersDirty && (
                        <span className="text-[11px] text-amber-300 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Unapplied changes
                        </span>
                      )}
                      <button
                        onClick={applyFilters}
                        disabled={!filtersDirty}
                        className={`text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg ${
                          filtersDirty
                            ? "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-cyan-950/40"
                            : "bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed shadow-none"
                        }`}
                      >
                        <Filter size={13} /> Apply Filters
                      </button>
                    </div>
                  </div>

                {(activeMesh || paperTypeFilter !== "all" || journalQualityFilter !== "all" || minCitationsFilter > 0 || minYearFilter || maxYearFilter) && (
                  <div className="px-4 py-3 border-t border-white/10 bg-slate-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400 font-semibold flex items-center gap-1">
                        <Filter size={13} className="text-cyan-400" /> Active Filters:
                      </span>
                      {activeMesh && (
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 flex items-center gap-1">
                          MeSH: <strong className="text-white">{activeMesh}</strong>
                          <button onClick={() => setActiveMesh(null)} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                        </span>
                      )}
                      {paperTypeFilter !== "all" && (
                        <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
                          Type: <strong className="text-white">{PAPER_TYPE_OPTIONS.find(p => p.key === paperTypeFilter)?.label}</strong>
                          <button onClick={clearPaperTypeFilter} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                        </span>
                      )}
                      {journalQualityFilter !== "all" && (
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 flex items-center gap-1">
                          Journal Quality: <strong className="text-white">
                            {journalQualityFilter === "q1" ? "Q1 Flagship" : journalQualityFilter === "q1q2" ? "Q1 & Q2 High Impact" : "Peer-Reviewed"}
                          </strong>
                          <button onClick={clearJournalQualityFilter} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                        </span>
                      )}
                      {minCitationsFilter > 0 && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 flex items-center gap-1">
                          Citations: <strong className="text-white">≥ {minCitationsFilter}</strong>
                          <button onClick={clearMinCitationsFilter} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                        </span>
                      )}
                      {(minYearFilter || maxYearFilter) && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                          Years: <strong className="text-white">{minYearFilter || "1900"} – {maxYearFilter || new Date().getFullYear()}</strong>
                          <button onClick={clearYearFilter} className="ml-1 hover:text-white cursor-pointer"><X size={12} /></button>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={clearAllFilters}
                      className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}

              </section>

              {/* Publication Volume Trend Chart (collapsible) */}
              <section className="mb-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTrendChart((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 p-5 text-left cursor-pointer hover:bg-white/5 transition"
                >
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <BarChart2 size={15} className="text-blue-400" /> Number of Published Papers per Year
                      {trendLoading && <Loader2 size={12} className="animate-spin text-blue-400" />}
                    </h2>
                    <p className="text-xs mt-0.5 text-slate-400">
                      Click to {showTrendChart ? "hide" : "show"} the publication volume trend chart for <strong className="text-blue-300 font-mono">"{activeTerm}"</strong>
                    </p>
                  </div>
                  {showTrendChart ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>

                {showTrendChart && trendData.length === 0 && (
                  <div className="px-5 pb-5 text-xs text-slate-400">No trend data available yet.</div>
                )}

                {showTrendChart && trendData.length > 0 && (
                <div className="px-5 pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        Relative Publication Volume ({trendMode === "monthly" ? "Monthly" : "Yearly"})
                      </h3>
                      <p className="text-xs mt-0.5 text-slate-400">
                        Proportional research output volume for <strong className="text-blue-300 font-mono">"{activeTerm}"</strong> (Bar lengths represent relative paper count)
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Summary Metrics */}
                      {(() => {
                        const counts = trendData.map((d) => d.count || 0);
                        const maxVal = Math.max(...counts, 1);
                        const peakItem = trendData.find((d) => d.count === maxVal);
                        const totalPeriodVal = counts.reduce((a, b) => a + b, 0);

                        return (
                          <div className="hidden sm:flex items-center gap-3 text-xs bg-slate-900/60 border border-white/10 px-3 py-1.5 rounded-xl font-mono">
                            <span className="text-slate-400">
                              Peak: <strong className="text-cyan-300">{peakItem ? `${peakItem.label} (${peakItem.count?.toLocaleString()})` : "—"}</strong>
                            </span>
                            <span className="text-slate-600">|</span>
                            <span className="text-slate-400">
                              Total Period: <strong className="text-emerald-300">{totalPeriodVal.toLocaleString()}</strong>
                            </span>
                          </div>
                        );
                      })()}

                      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                          onClick={() => setTrendMode("yearly")}
                          className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                            trendMode === "yearly" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Yearly
                        </button>
                        <button
                          onClick={() => setTrendMode("monthly")}
                          className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                            trendMode === "monthly" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Monthly
                        </button>
                      </div>
                    </div>
                  </div>

                  {trendLoading ? (
                    <div className="py-12 text-center text-xs text-blue-400 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Querying NCBI Entrez publication volume across periods...
                    </div>
                  ) : (
                    (() => {
                      const maxVal = Math.max(...trendData.map((d) => d.count || 0), 1);

                      return (
                        <div className="relative pt-6 pb-2 px-1">
                          {/* Relative Percentage Baseline Reference Grid */}
                          <div className="absolute inset-x-0 top-6 bottom-8 pointer-events-none flex flex-col justify-between text-[10px] font-mono text-slate-600/60">
                            <div className="border-b border-white/10 w-full flex justify-between pr-2">
                              <span>100% ({maxVal.toLocaleString()})</span>
                            </div>
                            <div className="border-b border-white/5 w-full flex justify-between pr-2">
                              <span>75% ({Math.round(maxVal * 0.75).toLocaleString()})</span>
                            </div>
                            <div className="border-b border-white/5 w-full flex justify-between pr-2">
                              <span>50% ({Math.round(maxVal * 0.5).toLocaleString()})</span>
                            </div>
                            <div className="border-b border-white/5 w-full flex justify-between pr-2">
                              <span>25% ({Math.round(maxVal * 0.25).toLocaleString()})</span>
                            </div>
                            <div className="border-b border-white/10 w-full"></div>
                          </div>

                          {/* Relative Bar Graph Container */}
                          <div className="h-48 flex items-end gap-2 pt-2 pb-6 px-4 overflow-x-auto relative z-10">
                            {trendData.map((pd) => {
                              const count = pd.count ?? 0;
                              const pct = Math.round((count / maxVal) * 100);
                              const isPeak = count === maxVal && maxVal > 0;

                              return (
                                <div
                                  key={pd.label}
                                  onClick={() => {
                                    if (trendMode === "yearly") {
                                      setMinYearFilter(pd.label);
                                      setMaxYearFilter(pd.label);
                                      setDatePreset("custom");
                                      setDraftMinYearFilter(pd.label);
                                      setDraftMaxYearFilter(pd.label);
                                      setDraftDatePreset("custom");
                                    }
                                  }}
                                  className="flex-1 flex flex-col items-center min-w-[32px] h-full justify-end group cursor-pointer"
                                  title={`${pd.label}: ${count.toLocaleString()} papers (${pct}% of peak volume). Click to filter table.`}
                                >
                                  {/* Paper Count Badge Above Bar */}
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded mb-1 transition-all whitespace-nowrap ${
                                      isPeak
                                        ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 font-bold opacity-100"
                                        : "bg-slate-800/80 text-slate-300 opacity-80 group-hover:opacity-100 group-hover:scale-110"
                                    }`}
                                  >
                                    {count > 0 ? (count > 9999 ? `${(count / 1000).toFixed(1)}k` : count.toLocaleString()) : "0"}
                                  </span>

                                  {/* Proportional Relative Bar */}
                                  <div className="w-full h-full flex items-end bg-slate-800/20 rounded-t-md overflow-hidden p-0.5">
                                    <div
                                      style={{ height: `${count === 0 ? 3 : pct}%` }}
                                      className={`w-full rounded-t-sm transition-all duration-300 ${
                                        isPeak
                                          ? "bg-gradient-to-t from-blue-600 via-cyan-400 to-teal-300 shadow-lg shadow-cyan-500/40 brightness-110"
                                          : "bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-400 opacity-85 group-hover:opacity-100 group-hover:brightness-125"
                                      }`}
                                    ></div>
                                  </div>

                                  {/* Label / Year / Month */}
                                  <span
                                    className={`text-[10px] font-mono mt-2 truncate max-w-full transition-colors ${
                                      isPeak ? "text-cyan-300 font-bold" : "text-slate-400 group-hover:text-white"
                                    }`}
                                  >
                                    {pd.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 pt-1 font-mono">
                            <span>* Click any bar to drill down into publications for that period</span>
                            <span className="text-cyan-400">Peak Volume = 100% relative scale</span>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
                )}
              </section>

              {/* MeSH Word Frequency & Co-occurrence Analysis Section (collapsible) */}
              <section className="mb-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMeshSection((v) => !v)}
                  className="w-full flex items-center justify-between gap-3 p-5 text-left cursor-pointer hover:bg-white/5 transition"
                >
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Tag size={15} className="text-cyan-400" /> MeSH Words ({meshKeywords.length} terms analyzed)
                    </h2>
                    <p className="text-xs mt-0.5 text-slate-400">
                      Click to {showMeshSection ? "hide" : "show"} the top Medical Subject Headings extracted from PubMed abstracts.
                    </p>
                  </div>
                  {showMeshSection ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                </button>

                {showMeshSection && (
                <div className="px-5 pb-5">
                  <div className="flex items-center justify-end gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10 mb-4 w-fit ml-auto">
                    <button
                      onClick={() => setMeshSectionTab("ranked")}
                      className={`text-xs px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${
                        meshSectionTab === "ranked"
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <ListOrdered size={14} /> Ranked MeSH Terms
                    </button>
                    <button
                      onClick={() => setMeshSectionTab("graph")}
                      className={`text-xs px-3 py-1.5 rounded-lg transition font-medium cursor-pointer flex items-center gap-1.5 ${
                        meshSectionTab === "graph"
                          ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-md"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Network size={14} /> Co-occurrence Network Graph
                    </button>
                  </div>

                  {meshSectionTab === "ranked" ? (
                    <RankedMeshList
                      meshKeywords={meshKeywords}
                      activeMesh={activeMesh}
                      onSelectMesh={setActiveMesh}
                      meshSearchTerm={meshSearchTerm}
                      onMeshSearchChange={setMeshSearchTerm}
                      isScanningMesh={isScanningMesh}
                      meshScanProgress={meshScanProgress}
                      onScanHistoricalMesh={scanHistoricalMeshTerms}
                      totalCount={totalCount}
                      historicalFetchedCount={historicalMeshLists.length}
                    />
                  ) : (
                    <MeshCooccurrenceGraph
                      historicalMeshLists={historicalMeshLists}
                      activeMesh={activeMesh}
                      onSelectMesh={setActiveMesh}
                    />
                  )}
                </div>
                )}
              </section>

              {/* Papers Retrieved Summary */}
              <div className="text-xs mb-6 flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-slate-300">
                <div className="flex items-center gap-2">
                  {loading ? (
                    <span className="flex items-center gap-2 font-medium text-blue-400">
                      <Loader2 size={15} className="animate-spin" /> Fetching PubMed records for page {currentPage}...
                    </span>
                  ) : error ? (
                    <span className="text-red-400 font-medium">{error}</span>
                  ) : (
                    <span className="flex items-center gap-2 font-medium text-slate-200">
                      <Activity size={15} className="text-emerald-400" />
                      <strong className="font-bold text-white text-sm">{totalCount.toLocaleString()}</strong> historical articles found{!fillModeActive && totalCount > 0 && (
                        <span className="text-slate-400 font-mono text-[11px]">in {totalPages.toLocaleString()} page{totalPages === 1 ? "" : "s"}</span>
                      )}
                      {(minYearFilter || maxYearFilter) && (
                        <span className="text-slate-400 font-mono text-[11px]">
                          ({minYearFilter || "1900"}–{maxYearFilter || new Date().getFullYear()})
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {!loading && totalCount > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      {fillModeActive
                        ? `Page ${currentPage}${pageHasMore ? " (more available)" : " (last page)"} — ${articles.length} matching records`
                        : `Page ${currentPage} of ${totalPages} (${articles.length} records on page)`}
                    </span>
                    <button
                      onClick={exportToCSV}
                      className="text-xs px-3 py-1.5 rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
                      title="Export current page to CSV"
                    >
                      <Download size={13} /> Export CSV
                    </button>
                  </div>
                )}
              </div>


              {/* Articles Table with Pagination & Global Filters */}
              {!loading && sortedArticles.length > 0 && (
                <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-8">

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5 text-[11px] uppercase tracking-wider text-slate-400">
                          {COLUMNS.map((col) => (
                            <th
                              key={col.key}
                              onClick={() => col.sortable && handleSort(col.key)}
                              className={`text-left py-3.5 px-4 font-bold ${col.sortable ? "cursor-pointer select-none hover:text-white" : ""}`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {col.label}
                                {col.key === "paperType" && paperTypeFilter !== "all" && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block ml-1 shadow" title="Paper type filter active" />
                                )}
                                {col.key === "journalQuality" && journalQualityFilter !== "all" && (
                                  <span className="w-2 h-2 rounded-full bg-purple-400 inline-block ml-1 shadow" title="Journal Quality filter active" />
                                )}
                                {col.key === "citations" && minCitationsFilter > 0 && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block ml-1 shadow" title="Min Citations filter active" />
                                )}
                                {col.key === "year" && (minYearFilter || maxYearFilter) && (
                                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1 shadow" title="Year column filter active" />
                                )}
                                {col.sortable && sortKey === col.key && (
                                  sortDir === "asc" ? <ChevronUp size={13} className="text-blue-400" /> : <ChevronDown size={13} className="text-blue-400" />
                                )}
                              </span>
                            </th>
                          ))}
                          <th className="text-right py-3.5 px-4 font-bold">Action</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-white/5">
                        {sortedArticles.map((a) => (
                          <tr key={a.pmid} className="hover:bg-white/5 transition-colors">
                            {/* Title & Authors */}
                            <td className="py-4 px-4 max-w-lg">
                              <button
                                onClick={() => setSelectedArticle(a)}
                                className="font-semibold text-left hover:text-blue-300 text-base leading-snug cursor-pointer block text-white transition"
                              >
                                {a.title}
                              </button>
                              <p className="text-xs mt-1 text-slate-400">
                                {a.authors}
                              </p>

                              {/* MeSH badges */}
                              {a.majorMeshTerms.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {a.majorMeshTerms.slice(0, 3).map((m, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setActiveMesh(m)}
                                      className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 hover:bg-cyan-500/30 text-blue-300 hover:text-cyan-200 border border-blue-400/20 transition cursor-pointer"
                                    >
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Paper Type Column */}
                            <td className="py-4 px-4 text-xs font-medium max-w-[150px]">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${getPaperTypeBadgeStyle(a.primaryPublicationType)}`}
                              >
                                <FileText size={12} className="shrink-0" />
                                <span className="truncate max-w-[110px]" title={a.primaryPublicationType}>
                                  {a.primaryPublicationType}
                                </span>
                              </span>
                            </td>

                            {/* Journal Column */}
                            <td className="py-4 px-4 text-xs font-medium max-w-[180px] italic text-slate-300">
                              {a.journal}
                            </td>

                            {/* Year */}
                            <td className="py-4 px-4 text-xs font-mono font-medium text-slate-300">
                              {a.year || "\u2014"}
                            </td>

                            {/* Citations & RCR */}
                            <td className="py-4 px-4 text-xs">
                              {a.citationCount != null ? (
                                <div>
                                  <span className="font-bold text-emerald-400">{a.citationCount.toLocaleString()}</span>
                                  <span className="text-[10px] block text-slate-500">citations</span>
                                  {a.rcr != null && (
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono inline-block mt-1 cursor-help border border-white/10"
                                      title="Relative Citation Ratio (RCR) by NIH iCite. Field- and year-normalized metric (1.0 = average NIH article impact)."
                                    >
                                      RCR {a.rcr.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>

                            {/* Journal Quality Indexing */}
                            <td className="py-4 px-4 text-xs max-w-[170px]">
                              <div
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-md ${a.journalQuality.badgeBg} ${a.journalQuality.badgeBorder} ${a.journalQuality.badgeText}`}
                                title={a.journalQuality.description}
                              >
                                <ShieldCheck size={13} className="shrink-0" />
                                <span className="font-extrabold text-[11px] tracking-wide whitespace-nowrap">{a.journalQuality.label}</span>
                              </div>
                              <span className="text-[10px] block mt-1 text-slate-400 truncate max-w-[150px]" title={a.journalQuality.description}>
                                {a.journalQuality.tier === "Q1" ? "Top 25% Flagship Journal" : a.journalQuality.tier === "Q2" ? "Leading Specialty Journal" : a.journalQuality.tier === "Q3" ? "MEDLINE Peer-Reviewed" : "PubMed Cataloged Record"}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedArticle(a)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer transition"
                                  title="Read Abstract & Details"
                                >
                                  <Info size={16} />
                                </button>

                                <button
                                  onClick={() => copyCitation(a)}
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer transition"
                                  title="Copy Citation"
                                >
                                  {copiedPmid === a.pmid ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                </button>

                                <a
                                  href={`https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition"
                                  title="Open in PubMed"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Bar */}
                  <div className="p-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Items per page:</span>
                      <select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                        className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white outline-none"
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={200}>200</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className="text-xs font-mono text-slate-300 px-2">
                        {fillModeActive ? `Page ${currentPage}${pageHasMore ? "" : " (last)"}` : `Page ${currentPage} of ${totalPages}`}
                      </span>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={fillModeActive ? !pageHasMore : currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {fillModeActive && pageHitCap && (
                    <div className="px-4 pb-4 -mt-2 bg-white/5">
                      <p className="text-[11px] text-amber-300/90 flex items-center gap-1.5">
                        <Info size={12} className="shrink-0" />
                        Only {articles.length} matching article{articles.length === 1 ? "" : "s"} found in the records scanned so far for this page — click <ChevronRight size={11} className="inline" /> to keep searching for more matches.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {!loading && sortedArticles.length === 0 && (
                <div className="py-12 text-center bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                  <p className="text-sm text-slate-400">
                    No articles found matching the selected filter criteria.
                  </p>
                </div>
              )}
            </>
          )}
        </main>

        {/* Article Abstract Modal Drawer with Frosted Glass Styling */}
        {selectedArticle && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900/90 border border-white/15 backdrop-blur-2xl rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 text-slate-200 shadow-2xl relative">
              <button
                onClick={() => setSelectedArticle(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 cursor-pointer text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  PMID: {selectedArticle.pmid}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getPaperTypeBadgeStyle(selectedArticle.primaryPublicationType)}`}
                >
                  <FileText size={13} />
                  <span>{selectedArticle.primaryPublicationType}</span>
                </span>

                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs ${selectedArticle.journalQuality.badgeBg} ${selectedArticle.journalQuality.badgeBorder} ${selectedArticle.journalQuality.badgeText}`}
                >
                  <ShieldCheck size={13} />
                  <span>{selectedArticle.journalQuality.label}</span>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold mt-3 mb-2 leading-snug text-white">
                {selectedArticle.title}
              </h2>

              <p className="text-xs font-medium mb-4 text-slate-400">
                {selectedArticle.authors}
              </p>

              <div className="flex flex-wrap gap-4 text-xs py-3 border-y border-white/10 mb-4 text-slate-300">
                <div><strong className="text-slate-400">Paper Type:</strong> {selectedArticle.primaryPublicationType}</div>
                <div><strong className="text-slate-400">Journal:</strong> {selectedArticle.journal}</div>
                <div><strong className="text-slate-400">Published:</strong> {selectedArticle.pubDate || selectedArticle.year}</div>
                {selectedArticle.citationCount != null && (
                  <div>
                    <strong className="text-slate-400">Citations:</strong>{" "}
                    <span className="text-emerald-400 font-bold">{selectedArticle.citationCount}</span>
                    {selectedArticle.rcr != null && <span className="text-slate-400 ml-1">(NIH RCR: {selectedArticle.rcr.toFixed(2)})</span>}
                  </div>
                )}
                {selectedArticle.doi && <div><strong className="text-slate-400">DOI:</strong> {selectedArticle.doi}</div>}
              </div>

              <div className="mb-4">
                <h3 className="text-xs tracking-wider uppercase font-bold text-slate-400 mb-2">Abstract</h3>
                <div className="text-sm leading-relaxed whitespace-pre-line text-slate-200 bg-white/5 p-4 rounded-xl border border-white/10">
                  {selectedArticle.abstract}
                </div>
              </div>

              {selectedArticle.meshTerms.length > 0 && (
                <div>
                  <h3 className="text-xs tracking-wider uppercase font-bold text-slate-400 mb-2">MeSH Topics</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedArticle.meshTerms.map((m: string, idx: number) => (
                      <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                <button
                  onClick={() => copyCitation(selectedArticle)}
                  className="text-xs px-3.5 py-2 rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 flex items-center gap-1.5 font-semibold cursor-pointer text-slate-200 transition"
                >
                  {copiedPmid === selectedArticle.pmid ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  {copiedPmid === selectedArticle.pmid ? "Citation Copied" : "Copy Citation"}
                </button>

                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${selectedArticle.pmid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-4 py-2 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 shadow-lg shadow-blue-900/30 transition"
                >
                  Open Full Article on PubMed <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="max-w-7xl mx-auto px-6 py-8 mt-12 border-t border-white/10 text-xs flex flex-wrap justify-between items-center gap-4 text-slate-400">
          <div>
            Data sources: National Library of Medicine (NCBI PubMed E-utilities API) &amp; NIH iCite Citation Index.
          </div>
          <div>
            PubMed Explorer &copy; {new Date().getFullYear()} &middot; Designed for Medical &amp; Scientific Researchers
          </div>
        </footer>
      </div>
    </div>
  );
}
