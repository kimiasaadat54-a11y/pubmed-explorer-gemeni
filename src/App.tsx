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
  ShieldCheck
} from "lucide-react";
import { FIELDS, MedicalField, Subspecialty } from "./data/subspecialties";
import { getJournalQualityInfo, JournalQualityInfo } from "./data/journalMetrics";

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
    for (let i = 17; i >= 0; i--) {
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

const COLUMNS = [
  { key: "title", label: "Article Title & Authors", sortable: false },
  { key: "journal", label: "Journal", sortable: true },
  { key: "year", label: "Year", sortable: true },
  { key: "citations", label: "Citations & NIH RCR", sortable: true },
  { key: "journalQuality", label: "Journal Indexing & Quality", sortable: true },
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

  // Sorting & Filtering
  const [sortKey, setSortKey] = useState<string>("year");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [activeMesh, setActiveMesh] = useState<string | null>(null);
  const [meshSearchTerm, setMeshSearchTerm] = useState<string>("");

  // MeSH Historical Extraction State
  const [historicalMeshLists, setHistoricalMeshLists] = useState<string[][]>([]);
  const [isScanningMesh, setIsScanningMesh] = useState<boolean>(false);
  const [meshScanProgress, setMeshScanProgress] = useState<{ fetched: number; target: number } | null>(null);

  // Trend Chart State
  const [trendMode, setTrendMode] = useState<"yearly" | "monthly">("yearly");
  const [trendData, setTrendData] = useState<TrendPeriod[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(() => lastTwoYearsFilter());

  // Article Modal Drawer State
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [copiedPmid, setCopiedPmid] = useState<string | null>(null);

  // Interactive Bar Dragging Refs
  const [dragRange, setDragRange] = useState<{ start: number; end: number } | null>(null);
  const draggingRef = useRef(false);

  const initializeSearch = useCallback(async (term: string, field: MedicalField | null, sub: Subspecialty | null, filter: DateFilter | null) => {
    setLoading(true);
    setError(null);
    setActiveMesh(null);
    setActiveField(field);
    setActiveSub(sub);
    setActiveTerm(term);
    setCurrentPage(1);
    setHistoricalMeshLists([]);
    setMeshScanProgress(null);

    const dateParams = filter ? `&datetype=pdat&mindate=${filter.mindate}&maxdate=${filter.maxdate}` : "";
    const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&usehistory=y&sort=date${dateParams}&term=${encodeURIComponent(term)}`;

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

      // Fetch Page 1 Articles
      await fetchArticlePage(1, pageSize, env, key, total);
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

  // Fetch Page of Articles using Entrez History WebEnv & query_key
  const fetchArticlePage = async (page: number, size: number, env: string, key: string, total: number) => {
    setLoading(true);
    setError(null);

    const retstart = (page - 1) * size;
    const retmax = size;
    const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&query_key=${key}&WebEnv=${env}&retstart=${retstart}&retmax=${retmax}`;

    try {
      const xmlText = await fetchWithRetry<string>(efetchUrl, 3, "text");
      const parsedArticles = parseArticleXML(xmlText);

      // Collect PMIDs to fetch citations from NIH iCite
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

      setArticles(completeArticles);
      setCurrentPage(page);

      // Append new MeSH lists to historical memory
      const newMeshLists = parsedArticles.map(a => a.meshTerms);
      setHistoricalMeshLists(prev => [...prev, ...newMeshLists]);

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

  // Page Navigation Handlers
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage || !webEnv || !queryKey) return;
    fetchArticlePage(newPage, pageSize, webEnv, queryKey, totalCount);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    if (webEnv && queryKey && totalCount > 0) {
      fetchArticlePage(1, newSize, webEnv, queryKey, totalCount);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);

  // Run Search when date filter changes
  useEffect(() => {
    if (activeTerm) {
      initializeSearch(activeTerm, activeField, activeSub, dateFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

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
    setArticles([]);
    setTotalCount(0);
    setError(null);
    setTrendData([]);
    setHistoricalMeshLists([]);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = inputValue.trim();
    if (!term) return;
    initializeSearch(term, activeField, activeSub, dateFilter);
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

  // Filter & Sort Articles
  const filteredArticles = useMemo(() => {
    if (!activeMesh) return articles;
    return articles.filter((a) => (a.meshTerms || []).some((t) => t.toLowerCase() === activeMesh.toLowerCase()));
  }, [articles, activeMesh]);

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
    const headers = ["PMID", "Title", "Journal", "Year", "Citations", "NIH_RCR", "Journal_Quality_Tier", "DOI", "Authors"];
    const rows = articles.map(a => [
      `"${a.pmid}"`,
      `"${a.title.replace(/"/g, '""')}"`,
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

  const yearDropdownValue = dateFilter && /^\d{4}$/.test(dateFilter.label) ? dateFilter.label : "custom";

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
                      onClick={() => initializeSearch(s.query, activeField, s, dateFilter)}
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

                <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-xl backdrop-blur-md">
                  <Calendar size={14} className="text-slate-400" />
                  <select
                    value={yearDropdownValue}
                    onChange={(e) => {
                      if (e.target.value === "2y") setDateFilter(lastTwoYearsFilter());
                      else if (e.target.value === "5y") {
                        const now = new Date();
                        const fiveAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
                        setDateFilter({ mindate: fmtDate(fiveAgo), maxdate: fmtDate(now), label: "Last 5 years" });
                      } else if (e.target.value === "10y") {
                        const now = new Date();
                        const tenAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
                        setDateFilter({ mindate: fmtDate(tenAgo), maxdate: fmtDate(now), label: "Last 10 years" });
                      } else if (e.target.value === "all") setDateFilter(null);
                      else setDateFilter({ mindate: `${e.target.value}/01/01`, maxdate: `${e.target.value}/12/31`, label: e.target.value });
                    }}
                    className="text-xs outline-none bg-transparent cursor-pointer font-medium text-slate-200"
                  >
                    <option value="2y" className="bg-slate-900 text-slate-200">Timeframe: Last 2 years</option>
                    <option value="5y" className="bg-slate-900 text-slate-200">Timeframe: Last 5 years</option>
                    <option value="10y" className="bg-slate-900 text-slate-200">Timeframe: Last 10 years</option>
                    <option value="all" className="bg-slate-900 text-slate-200">Timeframe: All Historical Years</option>
                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                      <option key={y} value={y} className="bg-slate-900 text-slate-200">{y} only</option>
                    ))}
                  </select>
                </div>

                {dateFilter && (
                  <button
                    type="button"
                    onClick={() => setDateFilter(null)}
                    className="text-xs px-2.5 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-blue-300 flex items-center gap-1 backdrop-blur-md"
                    title="Remove Date Filter"
                  >
                    <X size={12} /> {dateFilter.label}
                  </button>
                )}
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
              {/* Status Bar */}
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
                      <strong className="font-bold text-white text-sm">{totalCount.toLocaleString()}</strong> historical articles found
                      {dateFilter && <span className="text-slate-400">({dateFilter.label})</span>}
                    </span>
                  )}
                </div>

                {!loading && totalCount > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-slate-400">
                      Page {currentPage} of {totalPages} ({articles.length} records on page)
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

              {/* Publication Volume Trend Chart */}
              {trendData.length > 0 && (
                <section className="mb-8 p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <BarChart2 size={15} className="text-blue-400" /> Historical PubMed Publication Velocity
                      </h2>
                      <p className="text-xs mt-0.5 text-slate-400">
                        Annual research publication volumes on PubMed for term: <strong className="text-blue-300 font-mono">"{activeTerm}"</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                      <button
                        onClick={() => setTrendMode("yearly")}
                        className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                          trendMode === "yearly" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Yearly
                      </button>
                      <button
                        onClick={() => setTrendMode("monthly")}
                        className={`text-xs px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                          trendMode === "monthly" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Monthly
                      </button>
                    </div>
                  </div>

                  {trendLoading ? (
                    <div className="py-12 text-center text-xs text-blue-400 flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Querying NCBI Entrez search index across periods...
                    </div>
                  ) : (
                    <div className="h-44 flex items-end gap-1.5 pt-6 pb-2 px-2 overflow-x-auto">
                      {trendData.map((pd) => {
                        const maxCount = Math.max(...trendData.map((d) => d.count || 0), 1);
                        const pct = pd.count != null ? Math.round((pd.count / maxCount) * 100) : 0;

                        return (
                          <div key={pd.label} className="flex-1 flex flex-col items-center min-w-[28px] h-full justify-end group">
                            <span className="text-[10px] font-mono text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {pd.count != null ? pd.count.toLocaleString() : "—"}
                            </span>
                            <div
                              style={{ height: `${Math.max(pct, 4)}%` }}
                              className="w-full bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-sm group-hover:brightness-125 transition-all shadow-lg shadow-blue-500/20"
                            ></div>
                            <span className="text-[10px] font-mono mt-2 text-slate-400 group-hover:text-white truncate max-w-full">
                              {pd.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* MeSH Word Frequency Analysis across Historical Search Results */}
              <section className="mb-8 p-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div>
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Tag size={15} className="text-blue-400" /> Historical MeSH Keyword Trends ({meshKeywords.length} topics identified)
                    </h2>
                    <p className="text-xs mt-0.5 text-slate-400">
                      Medical Subject Headings extracted across articles. Click any MeSH keyword to filter page results.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={meshSearchTerm}
                      onChange={(e) => setMeshSearchTerm(e.target.value)}
                      placeholder="Filter MeSH topics..."
                      className="text-xs px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/60 text-white outline-none placeholder-slate-500 focus:border-blue-400/50"
                    />

                    {/* Button to trigger deep historical scanning */}
                    {totalCount > historicalMeshLists.length && (
                      <button
                        onClick={scanHistoricalMeshTerms}
                        disabled={isScanningMesh}
                        className="text-xs px-3.5 py-1.5 rounded-xl border border-blue-400/30 bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-900/30"
                        title="Fetch MeSH headings from historical search results beyond current page"
                      >
                        {isScanningMesh ? (
                          <><Loader2 size={12} className="animate-spin" /> Scanning MeSH ({meshScanProgress?.fetched}/{meshScanProgress?.target})...</>
                        ) : (
                          <><Sparkles size={12} /> Process All Historical MeSH Terms</>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* MeSH Keywords Tag Cloud */}
                {meshKeywords.length === 0 ? (
                  <p className="text-xs py-4 text-center text-slate-400">
                    {loading ? "Extracting MeSH headings..." : "No MeSH terms indexed for these articles yet."}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {filteredMeshKeywords.map(([term, count]) => {
                      const active = activeMesh?.toLowerCase() === term.toLowerCase();

                      return (
                        <button
                          key={term}
                          onClick={() => setActiveMesh(active ? null : term.toLowerCase())}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 backdrop-blur-md ${
                            active
                              ? "bg-blue-500/40 border-blue-400 text-white shadow-lg shadow-blue-500/20"
                              : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>{term}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                              active ? "bg-white/20 text-white" : "bg-white/10 text-slate-400"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {activeMesh && (
                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <span className="text-blue-300">
                      Filtering table by MeSH term: <strong>"{activeMesh}"</strong>
                    </span>
                    <button onClick={() => setActiveMesh(null)} className="underline cursor-pointer text-slate-400 hover:text-white">
                      Clear MeSH Filter
                    </button>
                  </div>
                )}
              </section>

              {/* Articles Table with Pagination */}
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
                                    <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-400/20">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Journal */}
                            <td className="py-4 px-4 text-xs font-medium max-w-[180px] text-slate-300 italic">
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
                        Page {currentPage} of {totalPages}
                      </span>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
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
                    {selectedArticle.meshTerms.map((m, idx) => (
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
