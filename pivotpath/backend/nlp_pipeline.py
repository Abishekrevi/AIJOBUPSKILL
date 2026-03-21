"""
PivotPath NLP Pipeline
Implements upgrades 13, 15, 18, 21, 22, 24:
  13. spaCy NER — auto-extract skills from user messages
  15. Sentiment analysis — emotional state detection
  18. Knowledge graph RAG — entity-relationship retrieval
  21. Intent classification — route queries to specialists
  22. KeyBERT keyword extraction — auto-update skill signals
  24. Guardrails — hallucination detection + response validation
"""

import re
import os
from typing import Optional

# ─── Upgrade 13: spaCy skill extraction ──────────────────────────────────────
_nlp = None
_skill_keywords = {
    "python", "excel", "sql", "tableau", "power bi", "ai", "machine learning",
    "prompt engineering", "data analysis", "project management", "leadership",
    "communication", "java", "javascript", "typescript", "react", "node",
    "llm", "fine-tuning", "mlops", "deep learning", "nlp", "r", "pandas",
    "scikit-learn", "tensorflow", "pytorch", "spark", "hadoop", "dbt",
    "business intelligence", "analytics", "statistics", "presentation",
    "stakeholder management", "agile", "scrum", "product management",
}


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            try:
                import subprocess
                subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"],
                               check=True, capture_output=True)
                import spacy
                _nlp = spacy.load("en_core_web_sm")
            except Exception as e:
                print(f"[spaCy] model load error: {e}")
    return _nlp


def extract_skills_from_text(text: str) -> list[str]:
    """
    Upgrade 13: Extract skill mentions from free text using:
    1. Rule-based keyword matching (fast, high precision)
    2. spaCy noun chunk extraction for unknown skills
    Returns deduplicated list of skill names.
    """
    found = set()
    text_lower = text.lower()

    # Rule-based: check known skill keywords
    for skill in _skill_keywords:
        if skill in text_lower:
            found.add(skill.title())

    # spaCy: extract noun chunks that might be skills
    nlp = _get_nlp()
    if nlp:
        try:
            doc = nlp(text_lower)
            for chunk in doc.noun_chunks:
                chunk_text = chunk.text.strip()
                if 2 <= len(chunk_text.split()) <= 4:
                    if any(kw in chunk_text for kw in _skill_keywords):
                        found.add(chunk_text.title())
            # Named entities of type ORG, PRODUCT often are tech tools
            for ent in doc.ents:
                if ent.label_ in ("ORG", "PRODUCT") and len(ent.text) < 30:
                    if any(kw in ent.text.lower() for kw in _skill_keywords):
                        found.add(ent.text.title())
        except Exception as e:
            print(f"[spaCy] extraction error: {e}")

    return list(found)


# ─── Upgrade 15: Sentiment analysis ──────────────────────────────────────────
_sentiment_pipeline = None


def _get_sentiment():
    global _sentiment_pipeline
    if _sentiment_pipeline is None:
        try:
            from transformers import pipeline
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model="distilbert-base-uncased-finetuned-sst-2-english",
                truncation=True,
                max_length=512
            )
        except Exception as e:
            print(f"[Sentiment] model load error: {e}")
    return _sentiment_pipeline


def analyze_sentiment(text: str) -> dict:
    """
    Upgrade 15: Detect emotional state from coach messages.
    Returns label (POSITIVE/NEGATIVE) and confidence score.
    Used to trigger HR alerts when worker shows sustained distress.
    """
    pipe = _get_sentiment()
    if not pipe:
        return {"label": "NEUTRAL", "score": 0.5, "available": False}
    try:
        result = pipe(text[:512])[0]
        return {
            "label": result["label"],
            "score": round(result["score"], 3),
            "available": True,
            "distressed": result["label"] == "NEGATIVE" and result["score"] > 0.85
        }
    except Exception as e:
        print(f"[Sentiment] analysis error: {e}")
        return {"label": "NEUTRAL", "score": 0.5, "available": False}


# ─── Upgrade 18: Knowledge graph RAG ─────────────────────────────────────────
_KG = None


def _get_kg():
    global _KG
    if _KG is None:
        import networkx as nx
        _KG = nx.MultiDiGraph()
    return _KG


def build_knowledge_graph(signals: list, credentials: list, employers: list):
    """
    Upgrade 18: Build entity-relationship knowledge graph from DB data.
    Nodes: skills, credentials, employers, roles
    Edges: teaches, values, required_for, leads_to
    """
    import json
    KG = _get_kg()
    KG.clear()

    for s in signals:
        KG.add_node(s.skill_name, type="skill",
                    demand=s.demand_score, growth=s.growth_rate,
                    uplift=s.avg_salary_uplift)

    for c in credentials:
        KG.add_node(c.title, type="credential",
                    provider=c.provider, weeks=c.duration_weeks,
                    placement=c.placement_rate)
        try:
            skills_taught = json.loads(c.skills_taught or "[]")
            for sk in skills_taught:
                if sk in [n for n in KG.nodes]:
                    KG.add_edge(c.title, sk, rel="teaches")
                    KG.add_edge(sk, c.title, rel="taught_by")
        except Exception:
            pass

    for e in employers:
        KG.add_node(e.name, type="employer", industry=e.industry)
        try:
            skills_needed = json.loads(e.skills_needed or "[]")
            for sk in skills_needed:
                if sk in [n for n in KG.nodes]:
                    KG.add_edge(sk, e.name, rel="valued_by")
                    KG.add_edge(e.name, sk, rel="requires")
        except Exception:
            pass


def kg_retrieve(entity_name: str, hops: int = 2) -> list[dict]:
    """
    Upgrade 18: Graph-aware retrieval — traverse entity neighborhood.
    Returns connected nodes with relationship context.
    Used to inject structured facts into RAG prompts.
    """
    import networkx as nx
    KG = _get_kg()
    if entity_name not in KG:
        # Try partial match
        matches = [n for n in KG.nodes if entity_name.lower() in n.lower()]
        if not matches:
            return []
        entity_name = matches[0]

    try:
        subgraph = nx.ego_graph(KG, entity_name, radius=hops)
        results = []
        for node, data in subgraph.nodes(data=True):
            if node == entity_name:
                continue
            edges = KG.edges(entity_name, data=True)
            rels = [d.get("rel", "related") for _, n, d in edges if n == node]
            results.append({
                "entity": node,
                "type": data.get("type", "unknown"),
                "relationship": rels[0] if rels else "related",
                "data": {k: v for k, v in data.items() if k != "type"}
            })
        return results[:10]
    except Exception as e:
        print(f"[KG] retrieval error: {e}")
        return []


def kg_to_context_string(entity: str) -> str:
    """Convert KG neighborhood to a readable context string for LLM injection."""
    nodes = kg_retrieve(entity, hops=2)
    if not nodes:
        return ""
    lines = [f"Knowledge graph context for '{entity}':"]
    for n in nodes:
        lines.append(f"  - {n['relationship'].replace('_', ' ')}: {n['entity']} ({n['type']})")
    return "\n".join(lines)


# ─── Upgrade 21: Intent classification ───────────────────────────────────────
_intent_classifier = None

_INTENT_TRAINING = [
    # SKILL_ADVICE
    ("what skills should I learn", "SKILL_ADVICE"),
    ("which skills are most in demand", "SKILL_ADVICE"),
    ("what should I study", "SKILL_ADVICE"),
    ("what technology should I focus on", "SKILL_ADVICE"),
    ("recommend a skill for me", "SKILL_ADVICE"),
    ("best skills for 2025", "SKILL_ADVICE"),
    # SALARY_QUESTION
    ("how much will I earn", "SALARY_QUESTION"),
    ("what is the salary for", "SALARY_QUESTION"),
    ("how much does a data analyst make", "SALARY_QUESTION"),
    ("what is the pay for ai pm", "SALARY_QUESTION"),
    ("salary uplift", "SALARY_QUESTION"),
    ("how much more will I make", "SALARY_QUESTION"),
    # CAREER_PATH
    ("show me my career path", "CAREER_PATH"),
    ("how do I transition to", "CAREER_PATH"),
    ("what is the path from", "CAREER_PATH"),
    ("route from my role to", "CAREER_PATH"),
    ("how to become an ai product manager", "CAREER_PATH"),
    ("steps to change career", "CAREER_PATH"),
    # EMOTIONAL_SUPPORT
    ("I am scared about losing my job", "EMOTIONAL_SUPPORT"),
    ("I feel anxious about the transition", "EMOTIONAL_SUPPORT"),
    ("this is really hard", "EMOTIONAL_SUPPORT"),
    ("I don't know if I can do this", "EMOTIONAL_SUPPORT"),
    ("I am stressed about reskilling", "EMOTIONAL_SUPPORT"),
    ("I feel overwhelmed", "EMOTIONAL_SUPPORT"),
    # CREDENTIAL_QUESTION
    ("which course should I take", "CREDENTIAL_QUESTION"),
    ("what credential is best", "CREDENTIAL_QUESTION"),
    ("recommend a certification", "CREDENTIAL_QUESTION"),
    ("how long does the bootcamp take", "CREDENTIAL_QUESTION"),
    ("is the coursera course good", "CREDENTIAL_QUESTION"),
    ("how much does the credential cost", "CREDENTIAL_QUESTION"),
    # JOB_MARKET
    ("who is hiring right now", "JOB_MARKET"),
    ("which companies are recruiting", "JOB_MARKET"),
    ("what jobs are available", "JOB_MARKET"),
    ("employer pipeline", "JOB_MARKET"),
    ("interview slots available", "JOB_MARKET"),
    ("which employers want ai skills", "JOB_MARKET"),
    # PROGRESS_CHECK
    ("how am I doing", "PROGRESS_CHECK"),
    ("what is my progress", "PROGRESS_CHECK"),
    ("how far along am I", "PROGRESS_CHECK"),
    ("am I on track", "PROGRESS_CHECK"),
    ("show me my roadmap", "PROGRESS_CHECK"),
]

_INTENT_SYSTEM_PROMPTS = {
    "SKILL_ADVICE": "Focus your response on specific high-demand skills, their demand scores, and salary uplift potential from the skills signal data.",
    "SALARY_QUESTION": "Focus on concrete salary figures, uplift projections, and ISA payment calculations.",
    "CAREER_PATH": "Focus on the graph-computed career path with exact steps, weeks, and costs.",
    "EMOTIONAL_SUPPORT": "Be warm and empathetic. Acknowledge their feelings before offering practical next steps. Keep it brief.",
    "CREDENTIAL_QUESTION": "Focus on specific employer-endorsed credentials with placement rates, durations, and costs.",
    "JOB_MARKET": "Focus on the employer pipeline, available interview slots, and skills companies are hiring for.",
    "PROGRESS_CHECK": "Summarise their progress percentage, completed credentials, and upcoming milestones.",
}


def classify_intent(text: str) -> str:
    """
    Upgrade 21: Classify message intent using TF-IDF + Logistic Regression.
    Routes queries to specialist response handlers.
    """
    global _intent_classifier
    if _intent_classifier is None:
        try:
            from sklearn.pipeline import Pipeline
            from sklearn.linear_model import LogisticRegression
            from sklearn.feature_extraction.text import TfidfVectorizer
            X, y = zip(*_INTENT_TRAINING)
            clf = Pipeline([
                ("tfidf", TfidfVectorizer(ngram_range=(1, 3), min_df=1)),
                ("clf", LogisticRegression(max_iter=500, C=5.0))
            ])
            clf.fit(X, y)
            _intent_classifier = clf
        except Exception as e:
            print(f"[Intent] classifier init error: {e}")
            return "GENERAL"

    try:
        return _intent_classifier.predict([text.lower()])[0]
    except Exception:
        return "GENERAL"


def get_intent_system_addition(intent: str) -> str:
    """Return specialist system prompt addition for a given intent."""
    return _INTENT_SYSTEM_PROMPTS.get(intent, "")


# ─── Upgrade 22: KeyBERT skill signal extraction ─────────────────────────────
_kw_model = None


def _get_kw_model():
    global _kw_model
    if _kw_model is None:
        try:
            from keybert import KeyBERT
            _kw_model = KeyBERT("all-MiniLM-L6-v2")
        except Exception as e:
            print(f"[KeyBERT] model load error: {e}")
    return _kw_model


def extract_skills_from_job_description(jd_text: str,
                                         top_n: int = 10) -> list[dict]:
    """
    Upgrade 22: Extract skill keywords from job descriptions using KeyBERT.
    Used by the weekly signal refresh job to update demand scores.
    """
    model = _get_kw_model()
    if not model:
        return []
    try:
        keywords = model.extract_keywords(
            jd_text,
            keyphrase_ngram_range=(1, 3),
            stop_words="english",
            top_n=top_n,
            use_maxsum=True,
            nr_candidates=20,
        )
        return [
            {"skill": kw, "relevance_score": round(score, 3)}
            for kw, score in keywords
            if score > 0.3 and len(kw) > 2
        ]
    except Exception as e:
        print(f"[KeyBERT] extraction error: {e}")
        return []


# ─── Upgrade 24: Guardrails — hallucination detection ────────────────────────
_VALID_SALARY_RANGE = (15_000, 500_000)
_SALARY_PATTERN = re.compile(r'\$[\d,]+(?:K|k)?')


def _parse_salary_mention(mention: str) -> Optional[int]:
    """Parse a salary mention like '$85K' or '$85,000' to integer."""
    try:
        clean = mention.replace("$", "").replace(",", "").strip()
        if clean.upper().endswith("K"):
            return int(float(clean[:-1]) * 1000)
        return int(clean)
    except Exception:
        return None


async def validate_response(response: str, db=None) -> tuple[str, bool, list[str]]:
    """
    Upgrade 24: Post-generation validation — check for hallucinated facts.
    Returns (response, is_valid, list_of_issues).
    Issues include: out-of-range salaries, fabricated credential names.
    """
    issues = []

    # Check salary figures are in plausible range
    salary_mentions = _SALARY_PATTERN.findall(response)
    for mention in salary_mentions:
        val = _parse_salary_mention(mention)
        if val and not (_VALID_SALARY_RANGE[0] <= val <= _VALID_SALARY_RANGE[1]):
            issues.append(f"Potentially hallucinated salary: {mention} (value: {val})")

    # Check for common hallucination patterns
    hallucination_phrases = [
        "as of my training data",
        "I cannot guarantee",
        "I don't have real-time",
        "my knowledge cutoff",
    ]
    for phrase in hallucination_phrases:
        if phrase.lower() in response.lower():
            issues.append(f"Hallucination signal phrase detected: '{phrase}'")

    # Check credential names if DB available
    if db:
        try:
            from sqlalchemy import select
            from database import Credential
            result = await db.execute(select(Credential.title))
            valid_titles = {row[0].lower() for row in result.all()}
            # Look for quoted credential-like names in response
            quoted = re.findall(r'"([^"]{10,60})"', response)
            for q in quoted:
                if any(word in q.lower() for word in ["course", "certificate", "bootcamp", "program"]):
                    if q.lower() not in valid_titles:
                        issues.append(f"Possibly fabricated credential: '{q}'")
        except Exception:
            pass

    is_valid = len(issues) == 0
    return response, is_valid, issues
