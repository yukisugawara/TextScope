from __future__ import annotations

import csv
import io
import itertools
import math
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

import networkx as nx
import numpy as np
import pdfplumber
import spacy
from bs4 import BeautifulSoup
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from janome.tokenizer import Tokenizer as JanomeTokenizer
from pydantic import BaseModel
from scipy.cluster.hierarchy import linkage, to_tree
from scipy.spatial.distance import pdist
from gensim.models import Word2Vec
from sklearn.decomposition import LatentDirichletAllocation, NMF, PCA
from sklearn.feature_extraction.text import CountVectorizer, TfidfTransformer

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI()

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Sample data
# ---------------------------------------------------------------------------
SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample"

SAMPLE_META: dict[str, dict[str, str]] = {
    "roomba_kawaii_35tweets_sample.txt": {
        "label": "Roomba x Kawaii Tweets",
        "label_ja": "ルンバ×可愛い ツイート",
        "description": "35 sample tweets about 'Roomba' and 'cute'",
        "description_ja": "「ルンバ」と「可愛い」に関するツイート35件のサンプルデータ",
    },
    "aozora-bunko": {
        "label": "Aozora Bunko (5 Authors)",
        "label_ja": "青空文庫（5作家）",
        "description": "938 works by Soseki, Ogai, Akutagawa, Dazai, Okamoto from Aozora Bunko",
        "description_ja": "夏目漱石・森鴎外・芥川龍之介・太宰治・岡本かの子の全938作品",
        "type": "collection",
    },
    "SOTU.csv": {
        "label": "State of the Union (1790–2018)",
        "label_ja": "一般教書演説 (1790–2018)",
        "description": "U.S. Presidential State of the Union addresses 1790–2018",
        "description_ja": "米国大統領の一般教書演説 1790–2018",
        "type": "csv",
    },
    "ted-talks.csv": {
        "label": "TED Talks (2006–2020)",
        "label_ja": "TED Talks (2006–2020)",
        "description": "4,005 TED Talk transcripts with speaker and topic metadata",
        "description_ja": "4,005件のTED Talks書き起こし（話者・トピック情報付き）",
        "type": "csv",
    },
}

# Aozora Bunko collection: dynamically scanned from sample/aozora-bunko/{author}/
def _scan_aozora_works() -> list[dict[str, str]]:
    """Scan aozora-bunko directory for all author/work pairs."""
    aozora_dir = SAMPLE_DIR / "aozora-bunko"
    if not aozora_dir.is_dir():
        return []
    works: list[dict[str, str]] = []
    for author_dir in sorted(aozora_dir.iterdir()):
        if not author_dir.is_dir():
            continue
        author = author_dir.name
        for txt in sorted(author_dir.iterdir()):
            if not txt.suffix == ".txt":
                continue
            title = txt.stem
            works.append({
                "filename": f"aozora-bunko/{author}/{txt.name}",
                "title": title,
                "author": author,
            })
    return works


AOZORA_WORKS: list[dict[str, str]] = _scan_aozora_works()

# ---------------------------------------------------------------------------
# NLP engines (lazy-loaded singletons)
# ---------------------------------------------------------------------------
_nlp_en: spacy.Language | None = None
_tok_ja: JanomeTokenizer | None = None


def get_nlp_en() -> spacy.Language:
    global _nlp_en
    if _nlp_en is None:
        _nlp_en = spacy.load("en_core_web_sm")
        _nlp_en.max_length = 30_000_000
    return _nlp_en


def get_tok_ja() -> JanomeTokenizer:
    global _tok_ja
    if _tok_ja is None:
        _tok_ja = JanomeTokenizer()
    return _tok_ja


# ---------------------------------------------------------------------------
# File extraction (unchanged)
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {"txt", "md", "xml", "pdf", "csv"}
TEXT_ENCODINGS = ["utf-8", "shift_jis", "euc-jp", "iso-2022-jp", "cp932", "latin-1"]


def detect_and_decode(raw: bytes) -> str:
    for enc in TEXT_ENCODINGS:
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode("utf-8", errors="replace")


def extract_text(filename: str, content: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    if ext == "pdf":
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                pages = [page.extract_text() or "" for page in pdf.pages]
            return "\n\n".join(pages)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {e}")

    text = detect_and_decode(content)

    if ext == "csv":
        import csv as csv_mod
        import sys as _sys
        csv_mod.field_size_limit(_sys.maxsize)
        reader = csv_mod.DictReader(io.StringIO(text))
        parts = []
        for row in reader:
            header = f"[{row.get('published_date', '')}] {row.get('main_speaker', '')} — {row.get('title', '')}"
            parts.append(f"{header}\n\n{row.get('transcript', '')}")
        return "\n\n---\n\n".join(parts)

    if ext == "xml":
        soup = BeautifulSoup(text, "html.parser")
        return soup.get_text(separator="\n")

    return text


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------
_RE_CJK = re.compile(
    r"[\u3000-\u303F\u3040-\u309F\u30A0-\u30FF"
    r"\u4E00-\u9FFF\uFF00-\uFFEF]"
)


def detect_language(text: str) -> str:
    """Return 'ja' if >=10 % of non-whitespace chars are CJK, else 'en'."""
    chars = [ch for ch in text if not ch.isspace()]
    if not chars:
        return "en"
    cjk_count = sum(1 for ch in chars if _RE_CJK.match(ch))
    return "ja" if cjk_count / len(chars) >= 0.1 else "en"


# ---------------------------------------------------------------------------
# POS mapping helpers
# ---------------------------------------------------------------------------
# spaCy Universal POS → readable label
_SPACY_POS_LABEL: dict[str, str] = {
    "NOUN": "Noun",
    "VERB": "Verb",
    "ADJ": "Adjective",
    "ADV": "Adverb",
    "PROPN": "Proper Noun",
}

# Janome POS prefix → readable label
_JANOME_POS_LABEL: dict[str, str] = {
    "名詞": "Noun",
    "動詞": "Verb",
    "形容詞": "Adjective",
    "副詞": "Adverb",
}

# Janome POS subtypes to exclude
_JANOME_STOP_SUBTYPES = {"非自立", "代名詞", "数", "接尾", "特殊"}

# English stopwords (small curated set on top of spaCy's is_stop)
_EN_EXTRA_STOP = {"be", "have", "do", "say", "get", "make", "go", "know", "take", "come"}


# ---------------------------------------------------------------------------
# Tokenisation & frequency counting
# ---------------------------------------------------------------------------
def _is_content_token(text: str) -> bool:
    """Filter out punctuation-only and single-character Latin tokens."""
    if not text.strip():
        return False
    if all(unicodedata.category(c).startswith("P") or unicodedata.category(c).startswith("S") for c in text):
        return False
    if len(text) == 1 and text.isascii():
        return False
    return True


_CHUNK_SIZE = 500_000  # characters per spaCy chunk


def _iter_chunks(text: str, size: int = _CHUNK_SIZE):
    """Yield text in roughly *size*-char pieces, splitting on whitespace."""
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            # back up to the last whitespace so we don't split a word
            ws = text.rfind(" ", start, end)
            if ws > start:
                end = ws
        yield text[start:end]
        start = end


def analyse_english(text: str) -> list[dict]:
    nlp = get_nlp_en()
    counter: Counter[tuple[str, str]] = Counter()

    for doc in nlp.pipe(_iter_chunks(text), batch_size=4):
        for token in doc:
            if token.is_stop or token.is_punct or token.is_space:
                continue
            pos_label = _SPACY_POS_LABEL.get(token.pos_)
            if pos_label is None:
                continue
            lemma = token.lemma_.lower()
            if lemma in _EN_EXTRA_STOP or not _is_content_token(lemma):
                continue
            counter[(lemma, pos_label)] += 1

    return [
        {"word": word, "pos": pos, "count": count}
        for (word, pos), count in counter.most_common()
    ]


def analyse_japanese(text: str) -> list[dict]:
    tok = get_tok_ja()
    counter: Counter[tuple[str, str]] = Counter()

    for token in tok.tokenize(text):
        parts = token.part_of_speech.split(",")
        major = parts[0]
        sub = parts[1] if len(parts) > 1 else ""

        pos_label = _JANOME_POS_LABEL.get(major)
        if pos_label is None:
            continue
        if sub in _JANOME_STOP_SUBTYPES:
            continue

        surface = token.surface
        if not _is_content_token(surface):
            continue

        counter[(surface, pos_label)] += 1

    return [
        {"word": word, "pos": pos, "count": count}
        for (word, pos), count in counter.most_common()
    ]


def compute_frequencies(text: str) -> tuple[str, list[dict]]:
    lang = detect_language(text)
    if lang == "ja":
        return lang, analyse_japanese(text)
    return lang, analyse_english(text)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class FrequencyRequest(BaseModel):
    text: str


class KwicRequest(BaseModel):
    text: str
    keyword: str
    context_len: int = 50
    context_words: int | None = None  # word-based context (overrides context_len)


class TrendsRequest(BaseModel):
    text: str
    keywords: list[str]
    segments: int = 10


class CooccurrenceRequest(BaseModel):
    text: str
    top_n: int = 60
    min_count: int = 1


class CorrespondenceRequest(BaseModel):
    text: str
    top_n: int = 50
    segments: int = 10


class ClusterRequest(BaseModel):
    text: str
    top_n: int = 40
    segments: int = 10


class CodingRule(BaseModel):
    name: str
    expression: str  # e.g. '"AI" AND ("文化" OR "社会")'


class CodeRequest(BaseModel):
    text: str
    rules: list[CodingRule]
    segments: int = 10


class TfidfRequest(BaseModel):
    text: str
    segments: int = 10
    top_n: int = 200


class LdaRequest(BaseModel):
    text: str
    n_topics: int = 5
    top_n_words: int = 10


class TopicRequest(BaseModel):
    text: str
    n_topics: int = 5
    top_n_words: int = 10
    method: str = "lda"  # "lda" | "nmf" | "bertopic"


class Word2VecRequest(BaseModel):
    text: str
    top_n: int = 80
    vector_size: int = 100
    window: int = 5
    min_count: int = 1
    selected_word: str = ""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/api/upload")
async def upload_file(file: UploadFile):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    content = await file.read()
    text = extract_text(file.filename, content)

    return {
        "filename": file.filename,
        "text": text,
        "length": len(text),
    }


@app.post("/api/frequencies")
async def frequencies(body: FrequencyRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    lang, items = compute_frequencies(body.text)
    return {"language": lang, "frequencies": items}


@app.post("/api/tfidf")
async def tfidf(body: TfidfRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    lang, top_words, matrix = _build_segment_matrix(
        body.text, body.top_n, max(1, min(body.segments, 100)),
    )

    if matrix.size == 0:
        return {"language": lang, "tfidf": []}

    # matrix is (n_words, n_segments) — transpose to (n_segments, n_words) for TfidfTransformer
    tf_matrix = matrix.T  # (n_segments, n_words)
    tfidf_matrix = TfidfTransformer().fit_transform(tf_matrix)  # sparse (n_segments, n_words)
    # Average TF-IDF score per word across segments
    mean_scores = np.asarray(tfidf_matrix.mean(axis=0)).flatten()  # (n_words,)

    # Get POS info from compute_frequencies
    _, freq_items = compute_frequencies(body.text)
    pos_map = {item["word"]: item["pos"] for item in freq_items}

    results = [
        {"word": w, "pos": pos_map.get(w, ""), "score": round(float(mean_scores[i]), 6)}
        for i, w in enumerate(top_words)
    ]
    results.sort(key=lambda x: x["score"], reverse=True)

    return {"language": lang, "tfidf": results}


def _trim_to_words_en(s: str, n_words: int, side: str) -> str:
    """Trim string to *n_words* whitespace-delimited tokens from the keyword side."""
    words = s.split()
    if side == "left":
        return " ".join(words[-n_words:]) if len(words) > n_words else s
    return " ".join(words[:n_words]) if len(words) > n_words else s


def _trim_to_words_ja(s: str, n_words: int, side: str) -> str:
    """Trim string to *n_words* Janome tokens from the keyword side."""
    tok = get_tok_ja()
    tokens = [t.surface for t in tok.tokenize(s)]
    if len(tokens) <= n_words:
        return s
    if side == "left":
        return "".join(tokens[-n_words:])
    return "".join(tokens[:n_words])


@app.post("/api/kwic")
async def kwic(body: KwicRequest):
    if not body.text.strip() or not body.keyword.strip():
        raise HTTPException(status_code=400, detail="text and keyword are required")

    keyword = body.keyword
    text = body.text
    results: list[dict] = []

    # Case-insensitive search for English; exact match for Japanese
    lang = detect_language(text)
    if lang == "en":
        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    else:
        pattern = re.compile(re.escape(keyword))

    use_words = body.context_words is not None
    if use_words:
        # Grab a generous character buffer, then trim to word count
        char_buf = body.context_words * 12  # ~12 chars/word worst case
    else:
        char_buf = body.context_len

    for m in pattern.finditer(text):
        start, end = m.start(), m.end()
        left = text[max(0, start - char_buf) : start]
        right = text[end : end + char_buf]

        if use_words:
            n = body.context_words  # type: ignore[assignment]
            if lang == "ja":
                left = _trim_to_words_ja(left, n, "left")
                right = _trim_to_words_ja(right, n, "right")
            else:
                left = _trim_to_words_en(left, n, "left")
                right = _trim_to_words_en(right, n, "right")

        results.append({
            "left": left,
            "keyword": m.group(),
            "right": right,
            "position": start,
        })

    return {"keyword": keyword, "language": lang, "results": results}


@app.post("/api/trends")
async def trends(body: TrendsRequest):
    if not body.text.strip() or not body.keywords:
        raise HTTPException(status_code=400, detail="text and keywords are required")

    text = body.text
    n = max(1, min(body.segments, 100))
    lang = detect_language(text)

    # Split text into n roughly-equal character segments
    seg_len = max(1, len(text) // n)
    segments: list[str] = []
    for i in range(n):
        start = i * seg_len
        end = start + seg_len if i < n - 1 else len(text)
        segments.append(text[start:end])

    # Count keyword occurrences per segment
    series: dict[str, list[int]] = {}
    for kw in body.keywords:
        flags = re.IGNORECASE if lang == "en" else 0
        pat = re.compile(re.escape(kw), flags)
        series[kw] = [len(pat.findall(seg)) for seg in segments]

    return {
        "segments": n,
        "labels": [f"{i + 1}" for i in range(n)],
        "series": series,
    }


# ---------------------------------------------------------------------------
# Sentence-level content-word extraction (shared by co-occurrence / CA / cluster)
# ---------------------------------------------------------------------------
_RE_SENTENCE_SPLIT = re.compile(r'[.!?\n。！？]+')


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _RE_SENTENCE_SPLIT.split(text) if s.strip()]


def _extract_content_words_en(sentence: str) -> list[str]:
    nlp = get_nlp_en()
    doc = nlp(sentence)
    words: list[str] = []
    for token in doc:
        if token.is_stop or token.is_punct or token.is_space:
            continue
        if _SPACY_POS_LABEL.get(token.pos_) is None:
            continue
        lemma = token.lemma_.lower()
        if lemma in _EN_EXTRA_STOP or not _is_content_token(lemma):
            continue
        words.append(lemma)
    return words


def _extract_content_words_ja(sentence: str) -> list[str]:
    tok = get_tok_ja()
    words: list[str] = []
    for token in tok.tokenize(sentence):
        parts = token.part_of_speech.split(",")
        major = parts[0]
        sub = parts[1] if len(parts) > 1 else ""
        if _JANOME_POS_LABEL.get(major) is None:
            continue
        if sub in _JANOME_STOP_SUBTYPES:
            continue
        if not _is_content_token(token.surface):
            continue
        words.append(token.surface)
    return words


def sentences_to_word_lists(text: str) -> tuple[str, list[list[str]]]:
    lang = detect_language(text)
    sentences = _split_sentences(text)
    extractor = _extract_content_words_en if lang == "en" else _extract_content_words_ja
    return lang, [extractor(s) for s in sentences]


def _build_segment_matrix(
    text: str, top_n: int, n_segments: int,
) -> tuple[str, list[str], np.ndarray]:
    """Build a (top_n words) × (n_segments) frequency matrix."""
    lang, _ = detect_language(text), None

    # Get top words (deduplicate: same lemma may appear with different POS)
    _, freq_items = compute_frequencies(text)
    seen: set[str] = set()
    top_words: list[str] = []
    for item in freq_items:
        if item["word"] not in seen:
            seen.add(item["word"])
            top_words.append(item["word"])
        if len(top_words) >= top_n:
            break
    if not top_words:
        return lang, [], np.empty((0, 0))

    # Split text into segments
    seg_len = max(1, len(text) // n_segments)
    segments: list[str] = []
    for i in range(n_segments):
        start = i * seg_len
        end = start + seg_len if i < n_segments - 1 else len(text)
        segments.append(text[start:end])

    # Count each word per segment
    matrix = np.zeros((len(top_words), n_segments), dtype=float)
    for j, seg in enumerate(segments):
        for i, w in enumerate(top_words):
            flags = re.IGNORECASE if lang == "en" else 0
            matrix[i, j] = len(re.findall(re.escape(w), seg, flags))

    return lang, top_words, matrix


# ---------------------------------------------------------------------------
# Co-occurrence network
# ---------------------------------------------------------------------------
@app.post("/api/cooccurrence")
async def cooccurrence(body: CooccurrenceRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    lang, word_lists = sentences_to_word_lists(body.text)

    # Count total word freq and pair co-occurrence
    word_freq: Counter[str] = Counter()
    pair_freq: Counter[tuple[str, str]] = Counter()

    for words in word_lists:
        unique = list(dict.fromkeys(words))  # dedupe within sentence, preserve order
        for w in unique:
            word_freq[w] += 1
        for a, b in itertools.combinations(sorted(set(unique)), 2):
            pair_freq[(a, b)] += 1

    # Keep only top_n words by frequency
    top_words = {w for w, _ in word_freq.most_common(body.top_n)}

    nodes = [
        {"id": w, "count": word_freq[w]}
        for w in top_words
    ]
    edges = [
        {"source": a, "target": b, "weight": c}
        for (a, b), c in pair_freq.most_common()
        if a in top_words and b in top_words and c >= body.min_count
    ]

    # -- Compute network metrics --
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"])
    for e in edges:
        G.add_edge(e["source"], e["target"], weight=e["weight"])

    degree_cent = nx.degree_centrality(G) if G.number_of_nodes() > 0 else {}
    betweenness_cent = nx.betweenness_centrality(G) if G.number_of_nodes() > 1 else {}
    closeness_cent = nx.closeness_centrality(G) if G.number_of_nodes() > 1 else {}

    communities: list[set] = []
    if G.number_of_nodes() > 0:
        try:
            communities = list(nx.community.louvain_communities(G, seed=42))
        except Exception:
            communities = [set(G.nodes())]

    community_map: dict[str, int] = {}
    for idx, comm in enumerate(communities):
        for nid in comm:
            community_map[nid] = idx

    for n in nodes:
        nid = n["id"]
        n["degree"] = round(degree_cent.get(nid, 0), 4)
        n["betweenness"] = round(betweenness_cent.get(nid, 0), 4)
        n["closeness"] = round(closeness_cent.get(nid, 0), 4)
        n["community"] = community_map.get(nid, 0)

    return {"nodes": nodes, "edges": edges, "communityCount": len(communities)}


# ---------------------------------------------------------------------------
# Correspondence Analysis
# ---------------------------------------------------------------------------
@app.post("/api/correspondence")
async def correspondence(body: CorrespondenceRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    lang, top_words, matrix = _build_segment_matrix(
        body.text, body.top_n, body.segments,
    )

    if matrix.size == 0 or matrix.sum() == 0:
        return {"words": [], "segments": []}

    # Standard correspondence analysis on the matrix
    grand_total = matrix.sum()
    P = matrix / grand_total  # proportion matrix
    row_mass = P.sum(axis=1, keepdims=True)
    col_mass = P.sum(axis=0, keepdims=True)

    # Avoid division by zero
    row_mass[row_mass == 0] = 1e-10
    col_mass[col_mass == 0] = 1e-10

    # Standardised residuals
    E = row_mass @ col_mass
    S = (P - E) / np.sqrt(E)

    # SVD
    U, sigma, Vt = np.linalg.svd(S, full_matrices=False)

    # Take first 2 dimensions
    dim = min(2, len(sigma))
    row_coords = U[:, :dim] * sigma[:dim]   # word coordinates
    col_coords = Vt[:dim, :].T * sigma[:dim] # segment coordinates

    words_out = [
        {"word": top_words[i], "x": float(row_coords[i, 0]), "y": float(row_coords[i, 1]) if dim > 1 else 0.0}
        for i in range(len(top_words))
    ]
    segs_out = [
        {"label": f"Seg {j+1}", "x": float(col_coords[j, 0]), "y": float(col_coords[j, 1]) if dim > 1 else 0.0}
        for j in range(body.segments)
    ]

    return {"words": words_out, "segments": segs_out}


# ---------------------------------------------------------------------------
# Hierarchical Cluster Analysis
# ---------------------------------------------------------------------------
def _tree_to_dict(node, labels: list[str]) -> dict:
    """Recursively convert scipy ClusterNode to a JSON-serialisable dict."""
    if node.is_leaf():
        return {"name": labels[node.id], "value": 1}
    return {
        "name": "",
        "distance": float(node.dist),
        "children": [
            _tree_to_dict(node.get_left(), labels),
            _tree_to_dict(node.get_right(), labels),
        ],
    }


@app.post("/api/cluster")
async def cluster(body: ClusterRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    lang, top_words, matrix = _build_segment_matrix(
        body.text, body.top_n, body.segments,
    )

    if len(top_words) < 2:
        return {"tree": None, "labels": top_words}

    # Normalise rows (L2) to focus on distribution pattern rather than magnitude
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1e-10
    normed = matrix / norms

    dist = pdist(normed, metric="cosine")
    # Replace any NaN with 1.0 (maximally dissimilar)
    dist = np.nan_to_num(dist, nan=1.0)

    Z = linkage(dist, method="ward")
    root = to_tree(Z)
    tree = _tree_to_dict(root, top_words)

    return {"tree": tree, "labels": top_words}


# ---------------------------------------------------------------------------
# Boolean expression parser for coding rules
# ---------------------------------------------------------------------------
def _tokenize_expr(expr: str) -> list[str]:
    """Tokenise a Boolean expression into words, AND, OR, (, )."""
    tokens: list[str] = []
    i = 0
    while i < len(expr):
        ch = expr[i]
        if ch.isspace():
            i += 1
            continue
        if ch in '()':
            tokens.append(ch)
            i += 1
            continue
        if ch == '"':
            j = expr.index('"', i + 1) if '"' in expr[i + 1:] else len(expr)
            tokens.append(expr[i + 1 : j])
            i = j + 1
            continue
        # Read a bare word
        j = i
        while j < len(expr) and expr[j] not in ' ()"':
            j += 1
        word = expr[i:j]
        tokens.append(word.upper() if word.upper() in ('AND', 'OR', 'NOT') else word)
        i = j
    return tokens


def _parse_expr(tokens: list[str], pos: int = 0):
    """Recursive descent parser: returns (ast_node, next_pos).
    AST nodes: ('TERM', word) | ('AND', left, right) | ('OR', left, right) | ('NOT', child)
    """
    node, pos = _parse_or(tokens, pos)
    return node, pos


def _parse_or(tokens, pos):
    left, pos = _parse_and(tokens, pos)
    while pos < len(tokens) and tokens[pos] == 'OR':
        pos += 1
        right, pos = _parse_and(tokens, pos)
        left = ('OR', left, right)
    return left, pos


def _parse_and(tokens, pos):
    left, pos = _parse_not(tokens, pos)
    while pos < len(tokens) and tokens[pos] == 'AND':
        pos += 1
        right, pos = _parse_not(tokens, pos)
        left = ('AND', left, right)
    return left, pos


def _parse_not(tokens, pos):
    if pos < len(tokens) and tokens[pos] == 'NOT':
        pos += 1
        child, pos = _parse_primary(tokens, pos)
        return ('NOT', child), pos
    return _parse_primary(tokens, pos)


def _parse_primary(tokens, pos):
    if pos < len(tokens) and tokens[pos] == '(':
        pos += 1  # skip (
        node, pos = _parse_or(tokens, pos)
        if pos < len(tokens) and tokens[pos] == ')':
            pos += 1
        return node, pos
    if pos < len(tokens):
        return ('TERM', tokens[pos]), pos + 1
    return ('TERM', ''), pos


def _eval_expr(node, text_lower: str, case_insensitive: bool = True) -> bool:
    """Evaluate an AST node against a text string."""
    tag = node[0]
    if tag == 'TERM':
        term = node[1].lower() if case_insensitive else node[1]
        target = text_lower if case_insensitive else text_lower  # caller provides lowered
        return term in target
    if tag == 'AND':
        return _eval_expr(node[1], text_lower, case_insensitive) and _eval_expr(node[2], text_lower, case_insensitive)
    if tag == 'OR':
        return _eval_expr(node[1], text_lower, case_insensitive) or _eval_expr(node[2], text_lower, case_insensitive)
    if tag == 'NOT':
        return not _eval_expr(node[1], text_lower, case_insensitive)
    return False


def compile_rule(expression: str):
    """Compile a Boolean expression string into an AST."""
    tokens = _tokenize_expr(expression)
    if not tokens:
        return ('TERM', '')
    ast, _ = _parse_expr(tokens)
    return ast


def rule_matches_text(ast, text: str) -> bool:
    return _eval_expr(ast, text.lower())


# ---------------------------------------------------------------------------
# Coding endpoint
# ---------------------------------------------------------------------------
@app.post("/api/code")
async def code(body: CodeRequest):
    if not body.text.strip() or not body.rules:
        raise HTTPException(status_code=400, detail="text and rules are required")

    text = body.text
    n = max(1, min(body.segments, 100))
    sentences = _split_sentences(text)

    # Compile rules
    compiled = []
    for rule in body.rules:
        try:
            ast = compile_rule(rule.expression)
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid expression: {rule.expression}")
        compiled.append((rule.name, ast))

    # Per-rule: tag each sentence + build segment counts
    seg_len = max(1, len(text) // n)
    results: list[dict] = []

    for name, ast in compiled:
        total_matches = 0
        segment_counts = [0] * n
        matched_sentences: list[dict] = []

        for sent in sentences:
            if rule_matches_text(ast, sent):
                total_matches += 1
                matched_sentences.append({"text": sent})
                # Find which segment this sentence belongs to
                pos = text.find(sent)
                if pos >= 0:
                    seg_idx = min(pos // seg_len, n - 1)
                    segment_counts[seg_idx] += 1

        results.append({
            "concept": name,
            "total_matches": total_matches,
            "total_sentences": len(sentences),
            "segment_counts": segment_counts,
            "matched_sentences": matched_sentences[:50],  # cap preview
        })

    return {
        "segments": n,
        "labels": [f"{i + 1}" for i in range(n)],
        "results": results,
    }


# ---------------------------------------------------------------------------
# Word2Vec
# ---------------------------------------------------------------------------
@app.post("/api/word2vec")
async def word2vec(body: Word2VecRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    lang, word_lists = sentences_to_word_lists(body.text)

    # Need at least some sentences
    non_empty = [wl for wl in word_lists if wl]
    if len(non_empty) < 2:
        return {"language": lang, "words": [], "neighbors": []}

    model = Word2Vec(
        non_empty,
        vector_size=body.vector_size,
        window=body.window,
        min_count=body.min_count,
        epochs=20,
    )

    # Pick top_n words by frequency that exist in model vocabulary
    _, freq_items = compute_frequencies(body.text)
    vocab = set(model.wv.key_to_index.keys())
    top_words = [item["word"] for item in freq_items if item["word"] in vocab][: body.top_n]

    if len(top_words) < 2:
        return {"language": lang, "words": [], "neighbors": []}

    vectors = np.array([model.wv[w] for w in top_words])
    coords = PCA(n_components=2).fit_transform(vectors)

    words_out = [
        {"word": top_words[i], "x": round(float(coords[i, 0]), 6), "y": round(float(coords[i, 1]), 6)}
        for i in range(len(top_words))
    ]

    neighbors: list[dict] = []
    if body.selected_word and body.selected_word in vocab:
        try:
            sims = model.wv.most_similar(body.selected_word, topn=10)
            neighbors = [{"word": w, "similarity": round(float(s), 4)} for w, s in sims]
        except KeyError:
            pass

    return {"language": lang, "words": words_out, "neighbors": neighbors}


# ---------------------------------------------------------------------------
# Topic Modeling (LDA / NMF / BERTopic)
# ---------------------------------------------------------------------------
def _run_matrix_topic_model(
    text: str, n_topics: int, top_n_words: int, method: str,
) -> dict:
    """Shared logic for LDA and NMF topic models."""
    lang, word_lists = sentences_to_word_lists(text)
    sentences = _split_sentences(text)

    docs = [" ".join(ws) for ws in word_lists]
    valid = [(i, d) for i, d in enumerate(docs) if d.strip()]
    if len(valid) < 2:
        return {"topics": [], "documents": []}

    valid_indices, valid_docs = zip(*valid)

    vectorizer = CountVectorizer(max_features=500)
    dtm = vectorizer.fit_transform(valid_docs)
    feature_names = vectorizer.get_feature_names_out()

    n_topics = max(2, min(n_topics, 20, len(valid_docs) - 1))

    if method == "nmf":
        tfidf_matrix = TfidfTransformer().fit_transform(dtm)
        model = NMF(
            n_components=n_topics,
            max_iter=200,
            random_state=42,
        )
        doc_topic = model.fit_transform(tfidf_matrix)
    else:
        model = LatentDirichletAllocation(
            n_components=n_topics,
            max_iter=30,
            random_state=42,
            learning_method="batch",
        )
        doc_topic = model.fit_transform(dtm)

    # Normalise doc-topic rows to sum to 1 (NMF doesn't produce probabilities)
    row_sums = doc_topic.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1e-10
    doc_topic = doc_topic / row_sums

    topics_out = []
    for t_idx in range(n_topics):
        word_weights = model.components_[t_idx]
        top_indices = word_weights.argsort()[::-1][:top_n_words]
        words = [
            {"word": str(feature_names[i]), "weight": round(float(word_weights[i]), 4)}
            for i in top_indices
            if word_weights[i] > 0
        ]
        topics_out.append({
            "id": t_idx,
            "label": words[0]["word"] if words else f"Topic {t_idx + 1}",
            "words": words,
        })

    docs_out = []
    for j, orig_idx in enumerate(valid_indices):
        dist = doc_topic[j].tolist()
        dominant = int(doc_topic[j].argmax())
        snippet = sentences[orig_idx][:80] if orig_idx < len(sentences) else ""
        docs_out.append({
            "sentence_index": int(orig_idx),
            "snippet": snippet,
            "dominant_topic": dominant,
            "distribution": [round(v, 4) for v in dist],
        })

    return {"topics": topics_out, "documents": docs_out}


def _run_bertopic(text: str, n_topics: int, top_n_words: int) -> dict:
    """Run BERTopic topic modeling (requires optional bertopic dependency)."""
    try:
        from bertopic import BERTopic as BERTopicModel
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="BERTopic not installed. Install bertopic and sentence-transformers.",
        )

    sentences = _split_sentences(text)
    if len(sentences) < 2:
        return {"topics": [], "documents": []}

    lang = detect_language(text)
    embedding_model = (
        "paraphrase-multilingual-MiniLM-L12-v2" if lang == "ja"
        else "all-MiniLM-L6-v2"
    )

    topic_model = BERTopicModel(
        nr_topics=n_topics,
        top_n_words=top_n_words,
        embedding_model=embedding_model,
        verbose=False,
    )
    topics_list, _probs = topic_model.fit_transform(sentences)

    topic_info = topic_model.get_topics()
    topics_out = []
    topic_ids = sorted(set(t for t in topics_list if t != -1))
    for new_idx, t_id in enumerate(topic_ids):
        word_weight_pairs = topic_info.get(t_id, [])
        words = [
            {"word": w, "weight": round(float(s), 4)}
            for w, s in word_weight_pairs[:top_n_words]
        ]
        topics_out.append({
            "id": new_idx,
            "label": words[0]["word"] if words else f"Topic {new_idx + 1}",
            "words": words,
        })

    id_remap = {t_id: new_idx for new_idx, t_id in enumerate(topic_ids)}
    docs_out = []
    for i, (sent, t_id) in enumerate(zip(sentences, topics_list)):
        dominant = id_remap.get(t_id, 0)
        n_out = len(topics_out) or 1
        dist = [0.0] * n_out
        if dominant < n_out:
            dist[dominant] = 1.0
        docs_out.append({
            "sentence_index": i,
            "snippet": sent[:80],
            "dominant_topic": dominant,
            "distribution": dist,
        })

    return {"topics": topics_out, "documents": docs_out}


@app.post("/api/topics")
async def topics(body: TopicRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    if body.method == "bertopic":
        return _run_bertopic(body.text, body.n_topics, body.top_n_words)

    if body.method not in ("lda", "nmf"):
        raise HTTPException(status_code=400, detail=f"Unknown method: {body.method}")

    return _run_matrix_topic_model(body.text, body.n_topics, body.top_n_words, body.method)


@app.post("/api/lda")
async def lda(body: LdaRequest):
    return await topics(TopicRequest(
        text=body.text, n_topics=body.n_topics, top_n_words=body.top_n_words, method="lda",
    ))


@app.post("/api/frequencies/csv")
async def frequencies_csv(body: FrequencyRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    _, items = compute_frequencies(body.text)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["word", "pos", "count"])
    for item in items:
        writer.writerow([item["word"], item["pos"], item["count"]])

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=frequencies.csv"},
    )


# ---------------------------------------------------------------------------
# Sample data endpoints
# ---------------------------------------------------------------------------
@app.get("/api/samples")
async def list_samples():
    return [
        {"filename": fn, **meta}
        for fn, meta in SAMPLE_META.items()
    ]


@app.get("/api/samples/{filename}/records")
async def list_sample_records(filename: str):
    """Return lightweight record list for CSV samples (no transcript)."""
    if filename not in SAMPLE_META:
        raise HTTPException(status_code=404, detail="Sample not found")
    meta = SAMPLE_META[filename]
    sample_type = meta.get("type")

    # --- Aozora Bunko collection ---
    if sample_type == "collection":
        records = []
        for idx, w in enumerate(AOZORA_WORKS):
            records.append({
                "index": idx,
                "title": w["title"],
                "speaker": w["author"],
                "date": w.get("year", ""),
            })
        return {"records": records}

    if sample_type != "csv":
        raise HTTPException(status_code=400, detail="Not a CSV sample")

    path = SAMPLE_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Sample file missing")

    import sys as _sys
    csv.field_size_limit(_sys.maxsize)
    text = detect_and_decode(path.read_bytes())
    reader = csv.DictReader(io.StringIO(text))
    records = []
    for idx, row in enumerate(reader):
        records.append({
            "index": idx,
            "title": row.get("title", ""),
            "speaker": row.get("main_speaker", ""),
            "date": row.get("published_date", ""),
        })
    return {"records": records}


@app.get("/api/samples/{filename}")
async def get_sample(filename: str, record: int | None = None):
    if filename not in SAMPLE_META:
        raise HTTPException(status_code=404, detail="Sample not found")

    meta = SAMPLE_META[filename]
    sample_type = meta.get("type")

    # --- Aozora Bunko collection ---
    if sample_type == "collection":
        if record is not None:
            if record < 0 or record >= len(AOZORA_WORKS):
                raise HTTPException(status_code=404, detail=f"Record {record} not found")
            work = AOZORA_WORKS[record]
            path = SAMPLE_DIR / work["filename"]
            if not path.is_file():
                raise HTTPException(status_code=404, detail="Sample file missing")
            text = detect_and_decode(path.read_bytes())
            label = f'{work["author"]} — {work["title"]}'
            return {"filename": label, "text": text, "length": len(text)}
        # No record specified — return first work as default
        work = AOZORA_WORKS[0]
        path = SAMPLE_DIR / work["filename"]
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Sample file missing")
        text = detect_and_decode(path.read_bytes())
        return {"filename": f'{work["author"]} — {work["title"]}', "text": text, "length": len(text)}

    path = SAMPLE_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Sample file missing")

    content = path.read_bytes()

    # If a specific record index is requested for CSV samples
    if record is not None and sample_type == "csv":
        import sys as _sys
        csv.field_size_limit(_sys.maxsize)
        text_raw = detect_and_decode(content)
        reader = csv.DictReader(io.StringIO(text_raw))
        for idx, row in enumerate(reader):
            if idx == record:
                header = f"[{row.get('published_date', '')}] {row.get('main_speaker', '')} — {row.get('title', '')}"
                text = f"{header}\n\n{row.get('transcript', '')}"
                label = row.get("title", "") or f"Record {record}"
                return {
                    "filename": label,
                    "text": text,
                    "length": len(text),
                }
        raise HTTPException(status_code=404, detail=f"Record {record} not found")

    text = extract_text(filename, content)

    return {
        "filename": filename,
        "text": text,
        "length": len(text),
    }
