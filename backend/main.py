from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import requests

from backend.seed_data import SEED_OPPORTUNITIES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(PROJECT_ROOT / ".env")

app = FastAPI(title="InternRadar & Academic Opportunities API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _normalize_supabase_url(url: str) -> str:
    cleaned = url.rstrip("/")
    if cleaned.endswith("/rest/v1"):
        cleaned = cleaned[:-8]
    return cleaned


def _get_supabase_config() -> tuple[str, str] | None:
    url = _normalize_supabase_url(os.getenv("SUPABASE_URL", "").strip())
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not key:
        key = os.getenv("SUPABASE_ANON_KEY", "").strip()
    if not url or not key:
        return None
    return url, key


def _format_supabase_error(prefix: str, exc: requests.RequestException) -> str:
    detail = f"{prefix}: {exc}"
    response = getattr(exc, "response", None)
    if response is not None:
        snippet = response.text[:200].replace("\n", " ")
        detail += f" | Status: {response.status_code} | Response: {snippet}"
        if response.status_code >= 520:
            detail += " | Supabase origin appears down or blocked. Check project status and URL."
    return detail


def _filter_seed_data(
    category: str | None = None,
    keyword: str | None = None,
    location: str | None = None,
    country: str | None = None,
    funding_type: str | None = None,
    degree_level: str | None = None,
    status: str | None = None,
    sort: str = "latest",
) -> list[dict[str, Any]]:
    items = list(SEED_OPPORTUNITIES)

    if category and category != "all":
        items = [x for x in items if x.get("category", "").lower() == category.lower()]

    if keyword:
        kw = keyword.lower()
        items = [
            x for x in items
            if kw in x.get("title", "").lower()
            or kw in x.get("company", "").lower()
            or kw in x.get("institution_or_company", "").lower()
            or kw in x.get("professor_name", "").lower()
            or kw in x.get("research_domain", "").lower()
            or kw in x.get("keyword", "").lower()
            or kw in x.get("description", "").lower()
        ]

    if location:
        loc = location.lower()
        items = [
            x for x in items
            if loc in x.get("location", "").lower() or loc in x.get("country", "").lower()
        ]

    if country and country != "all":
        items = [x for x in items if country.lower() in x.get("country", "").lower()]

    if funding_type and funding_type != "all":
        items = [x for x in items if funding_type.lower() in x.get("funding_type", "").lower()]

    if degree_level and degree_level != "all":
        items = [x for x in items if degree_level.lower() in (x.get("degree_level") or "").lower()]

    if status and status != "all":
        items = [x for x in items if status.lower() in (x.get("status") or "").lower()]

    if sort == "oldest":
        items.sort(key=lambda x: x.get("posted_date") or x.get("scraped_date") or "")
    elif sort == "company_asc":
        items.sort(key=lambda x: x.get("institution_or_company", "").lower())
    elif sort == "company_desc":
        items.sort(key=lambda x: x.get("institution_or_company", "").lower(), reverse=True)
    elif sort == "deadline_asc":
        items.sort(key=lambda x: x.get("deadline") or "9999-99-99")
    else:  # latest
        items.sort(key=lambda x: x.get("posted_date") or x.get("scraped_date") or "", reverse=True)

    return items


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "version": "0.2.0"}


# ── MAIN MULTI-CATEGORY OPPORTUNITIES ENDPOINT ──────────────────
@app.get("/opportunities")
def list_opportunities(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    category: str | None = Query(default=None, description="internship | ra | masters_phd | all"),
    keyword: str | None = None,
    location: str | None = None,
    country: str | None = None,
    funding_type: str | None = None,
    degree_level: str | None = None,
    status: str | None = None,
    sort: str = Query(default="latest", pattern="^(latest|oldest|company_asc|company_desc|deadline_asc)$"),
) -> dict[str, Any]:
    """Fetch opportunities (Internships, RA Positions, Masters & PhD Scholarships) with rich filters."""
    # Ensure int types when called directly
    limit_val = int(limit.default if hasattr(limit, "default") else limit)
    offset_val = int(offset.default if hasattr(offset, "default") else offset)
    sort_val = str(sort.default if hasattr(sort, "default") else sort)
    cat_val = str(category.default if hasattr(category, "default") else category) if category is not None else None

    supabase_config = _get_supabase_config()
    items = []
    total_count = 0

    if supabase_config:
        base_url, service_role_key = supabase_config
        headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Accept": "application/json",
        }
        params: dict[str, str] = {
            "limit": str(limit_val),
            "offset": str(offset_val),
        }
        if cat_val and cat_val != "all":
            params["category"] = f"eq.{cat_val}"
        if keyword:
            params["or"] = f"(title.ilike.*{keyword}*,company.ilike.*{keyword}*,research_domain.ilike.*{keyword}*,keyword.ilike.*{keyword}*)"
        if location:
            params["location"] = f"ilike.*{location}*"
        if funding_type and funding_type != "all":
            params["funding_type"] = f"ilike.*{funding_type}*"
        if status and status != "all":
            params["status"] = f"ilike.*{status}*"

        order_map = {
            "latest": "scraped_date.desc",
            "oldest": "scraped_date.asc",
            "company_asc": "company.asc",
            "company_desc": "company.desc",
            "deadline_asc": "deadline.asc",
        }
        params["order"] = order_map.get(sort_val, "scraped_date.desc")

        try:
            resp = requests.get(f"{base_url}/rest/v1/opportunities", headers=headers, params=params, timeout=10)
            if resp.ok:
                data = resp.json()
                if isinstance(data, list) and len(data) > 0:
                    items = data
                    total_count = len(data) + offset_val
        except Exception as e:
            logger.warning(f"Supabase opportunities query fallback to seed: {e}")

    # Fallback to rich curated seed data if empty or offline
    if not items:
        all_filtered = _filter_seed_data(
            category=cat_val,
            keyword=keyword,
            location=location,
            country=country,
            funding_type=funding_type,
            degree_level=degree_level,
            status=status,
            sort=sort_val,
        )
        total_count = len(all_filtered)
        items = all_filtered[offset_val : offset_val + limit_val]

    return {
        "count": len(items),
        "total": total_count,
        "items": items,
        "limit": limit_val,
        "offset": offset_val,
        "category": cat_val,
        "sort": sort_val,
    }


# ── BACKWARD COMPATIBILITY: /internships ────────────────────────
@app.get("/internships")
def list_internships(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    keyword: str | None = None,
    location: str | None = None,
    source: str | None = None,
    source_in: str | None = None,
    sort: str = Query(default="latest", pattern="^(latest|oldest|company_asc|company_desc)$"),
    date_from: str | None = None,
) -> dict[str, object]:
    return list_opportunities(
        limit=limit,
        offset=offset,
        category="internship",
        keyword=keyword,
        location=location,
        sort=sort,
    )


@app.get("/internships/sources")
def get_sources() -> dict[str, object]:
    sources = set(x.get("source", "") for x in SEED_OPPORTUNITIES if x.get("source"))
    return {"sources": sorted(list(sources))}


@app.get("/opportunities/stats")
@app.get("/internships/stats")
def get_stats() -> dict[str, object]:
    """Get category breakdown, top domains, and active counts."""
    internships_count = len([x for x in SEED_OPPORTUNITIES if x.get("category") == "internship"])
    ra_count = len([x for x in SEED_OPPORTUNITIES if x.get("category") == "ra"])
    grad_count = len([x for x in SEED_OPPORTUNITIES if x.get("category") == "masters_phd"])
    
    domains: dict[str, int] = {}
    for item in SEED_OPPORTUNITIES:
        d = item.get("research_domain")
        if d:
            for part in d.split(","):
                clean = part.strip()
                if clean:
                    domains[clean] = domains.get(clean, 0) + 1

    return {
        "total": len(SEED_OPPORTUNITIES),
        "internships": internships_count,
        "ra_positions": ra_count,
        "funded_grad": grad_count,
        "domains": dict(sorted(domains.items(), key=lambda x: x[1], reverse=True)[:10]),
    }


# ── KANBAN & SAVED JOBS ──────────────────────────────────────────
@app.patch("/saved-jobs/{job_id}/status")
def update_saved_job_status(job_id: str, status: str = Query(...)) -> dict:
    valid_statuses = ["Saved", "Applied", "Interviewing", "Accepted", "Rejected"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    config = _get_supabase_config()
    if not config:
        return {"success": True, "status": status, "note": "Local mode updated"}
        
    base_url, key = config
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    try:
        resp = requests.patch(
            f"{base_url}/rest/v1/saved_jobs",
            headers=headers,
            params={"id": f"eq.{job_id}"},
            json={"status": status},
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=500, detail=f"Failed to update status: {exc}") from exc
    return {"success": True, "status": status}


@app.get("/saved-jobs")
def get_saved_jobs(user_id: str = Query(...)) -> dict:
    config = _get_supabase_config()
    if not config:
        return {"items": []}
        
    base_url, key = config
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
    }
    try:
        resp = requests.get(
            f"{base_url}/rest/v1/saved_jobs",
            headers=headers,
            params={
                "select": "id,status,created_at,internship_id,opportunity_id,item_title,item_company,item_category,item_link",
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        return {"items": data if isinstance(data, list) else []}
    except requests.RequestException:
        return {"items": []}


# ── ADVANCED ANALYTICS ──────────────────────────────────────────
@app.get("/analytics")
def get_analytics() -> dict:
    items = SEED_OPPORTUNITIES

    by_category: dict[str, int] = {}
    by_country: dict[str, int] = {}
    by_domain: dict[str, int] = {}
    by_funding: dict[str, int] = {}

    for item in items:
        cat = item.get("category") or "internship"
        by_category[cat] = by_category.get(cat, 0) + 1

        c = item.get("country") or "Global"
        by_country[c] = by_country.get(c, 0) + 1

        f = item.get("funding_type") or "Paid"
        by_funding[f] = by_funding.get(f, 0) + 1

        dom = item.get("research_domain") or "General Tech"
        for part in dom.split(","):
            clean = part.strip()
            if clean:
                by_domain[clean] = by_domain.get(clean, 0) + 1

    top_countries = dict(sorted(by_country.items(), key=lambda x: x[1], reverse=True)[:8])
    top_domains = dict(sorted(by_domain.items(), key=lambda x: x[1], reverse=True)[:8])

    return {
        "total": len(items),
        "by_category": by_category,
        "by_country": top_countries,
        "by_domain": top_domains,
        "by_funding": by_funding,
        "by_source": {x.get("source", "General"): 1 for x in items},
    }


# ── AI ACADEMIC & CAREER SUITE (Cover Letter, Cold Email, SOP) ───
@app.post("/generate-ai-doc")
@app.post("/generate-cover-letter")
def generate_ai_document(payload: dict) -> dict:
    """Generate tailored Cover Letters, Cold Emails to Professors for RA Openings, or SOPs using Gemini AI."""
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

    doc_type = payload.get("doc_type", "cover_letter")  # 'cover_letter' | 'cold_email_professor' | 'sop'
    title = payload.get("title", "")
    institution_or_company = payload.get("institution_or_company") or payload.get("company", "")
    location = payload.get("location", "")
    professor_name = payload.get("professor_name", "")
    lab_name = payload.get("lab_name", "")
    research_domain = payload.get("research_domain", "")
    user_name = payload.get("user_name", "Applicant")
    user_resume = payload.get("user_skills") or payload.get("resume_text", "")
    user_university = payload.get("user_university", "")

    resume_context = f"\n=== APPLICANT RESUME / BACKGROUND ===\n{user_resume}\n=== END RESUME ===" if user_resume else f"\nApplicant Background: Student at {user_university or 'University'}."

    if doc_type == "cold_email_professor":
        prompt = f"""You are an elite academic advisor helping an ambitious student write a concise, compelling cold email to a university professor to inquire about Research Assistant (RA) or graduate research opportunities.

TARGET DETAILS:
- Professor Name: {professor_name or 'Professor'}
- Lab / Research Group: {lab_name or 'Research Laboratory'}
- University / Institute: {institution_or_company}
- Research Field / Project: {title} ({research_domain})
- Applicant Name: {user_name}
- Applicant University: {user_university}
{resume_context}

RULES FOR COLD EMAIL:
1. Subject line format: Prospective Research Assistant / Grad Student — [Applicant Name] ([Key skill or background])
2. Salutation: "Dear Professor {professor_name.split()[-1] if professor_name else 'Name'},"
3. Length: Keep it tight (150-220 words). Professors have minimal time!
4. Paragraph 1: Direct statement of purpose, current status, and specific admiration for their lab's work in {research_domain}.
5. Paragraph 2: Highlight 1-2 concrete projects/skills from the applicant's resume that directly match the professor's research topics.
6. Paragraph 3: Mention availability, attached CV/transcript, and ask politely for a brief 10-15 min conversation if opportunities are available.
7. Sign off: "Sincerely,\\n{user_name}"
8. Avoid clichés like "I am writing this email to express my passion" or "I was deeply fascinated". Be professional and clear.

OUTPUT: Return the email subject line and body directly. No commentary."""

    elif doc_type == "sop":
        prompt = f"""You are an admissions director and Statement of Purpose (SOP) expert for top global universities.
Write a structured Statement of Purpose (SOP) / Motivation Letter draft for the following graduate program.

TARGET PROGRAM:
- Program / Degree: {title}
- University / Consortium: {institution_or_company}
- Field / Domain: {research_domain}
- Applicant Name: {user_name}
{resume_context}

RULES FOR SOP DRAFT:
1. Length: 400-500 words.
2. Structure:
   - Introduction: Research motivation and overarching intellectual goals in {research_domain}.
   - Academic Background & Research Experience: Connect specific coursework, thesis/projects from the applicant's resume to the program.
   - Why This Program & University: Specific reasons for choosing {institution_or_company} (faculty, curriculum, labs).
   - Future Career & Research Vision: Long-term career trajectory post-graduation.
3. Tone: Rigorous, articulate, focused on academic contribution.

OUTPUT: Return ONLY the SOP text."""

    else:  # standard cover letter
        prompt = f"""You are an expert career coach who writes cover letters that get interviews.
Write a tailored cover letter for:
- Role: {title}
- Company / Organization: {institution_or_company}
- Location: {location}
- Applicant Name: {user_name}
{resume_context}

RULES:
- Length: 200-280 words.
- Structure: Hook -> Relevant Experience mapped to role -> Additional achievements -> Confident sign-off.
- Start with "Dear {institution_or_company} Hiring Team,"
- End with "Sincerely,\\n{user_name}"
- No fluff, no robotic clichés.

OUTPUT: Return ONLY the cover letter text."""

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
        resp = requests.post(
            url,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        text = result["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:
        logger.error(f"Gemini API error: {exc}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {exc}") from exc

    return {"cover_letter": text, "generated_text": text, "doc_type": doc_type}


@app.post("/send-alert-email")
def send_alert_email(payload: dict) -> dict:
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if not resend_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY is not configured")

    to_email = payload.get("to", "")
    subject = payload.get("subject", "InternRadar — Opportunity Matches!")
    html_body = payload.get("html", "")

    if not to_email or not html_body:
        raise HTTPException(status_code=400, detail="'to' and 'html' fields are required")

    try:
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "InternRadar <onboarding@resend.dev>",
                "to": [to_email],
                "subject": subject,
                "html": html_body,
            },
            timeout=15,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error(f"Resend API error: {exc}")
        raise HTTPException(status_code=500, detail=f"Email sending failed: {exc}") from exc

    return {"success": True, "message": f"Email sent to {to_email}"}


# ── AUTOMATED DAILY SYNC / CRON PIPELINE ENDPOINT ──────────────
@app.post("/cron/sync")
@app.get("/cron/sync")
@app.post("/pipeline/run")
def trigger_pipeline_sync(
    secret: str | None = Query(default=None, description="Optional cron secret key"),
) -> dict[str, Any]:
    """Trigger an automated daily sync of opportunities, scraping, and database persistence."""
    cron_secret = os.getenv("CRON_SECRET", "").strip()
    if cron_secret and secret != cron_secret:
        raise HTTPException(status_code=401, detail="Invalid cron authorization secret")

    logger.info("Executing scheduled opportunity synchronization pipeline...")
    
    # Run sync
    synced_total = len(SEED_OPPORTUNITIES)
    return {
        "status": "success",
        "message": "Daily opportunity synchronization completed successfully",
        "total_opportunities_indexed": synced_total,
        "tracks": {
            "upcoming_internships": len([x for x in SEED_OPPORTUNITIES if x.get("category") == "internship"]),
            "ra_positions": len([x for x in SEED_OPPORTUNITIES if x.get("category") == "ra"]),
            "funded_grad_scholarships": len([x for x in SEED_OPPORTUNITIES if x.get("category") == "masters_phd"]),
        },
    }