from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

TRACKING_PREFIXES = ("utm_", "trk", "ref", "src")


def normalize_link(raw_url: str) -> str:
    if not raw_url:
        return ""

    parsed = urlsplit(raw_url.strip())
    filtered_query = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=False)
        if not any(key.lower().startswith(prefix) for prefix in TRACKING_PREFIXES)
    ]
    normalized_query = urlencode(filtered_query)

    path = parsed.path.rstrip("/") or "/"
    return urlunsplit((parsed.scheme, parsed.netloc, path, normalized_query, ""))


@dataclass
class Opportunity:
    """Represents an opportunity: Internship, Research Assistant (RA), or Funded Grad Program (Masters/PhD)."""
    id: str | None = None
    category: str = "internship"  # 'internship' | 'ra' | 'masters_phd'
    title: str = ""
    institution_or_company: str = ""
    location: str = ""
    country: str = ""
    link: str = ""
    source: str = ""
    deadline: str | None = None
    status: str = "Open"  # 'Upcoming' | 'Open' | 'Closes Soon' | 'Rolling'
    
    # Academic & Research Specific Fields
    degree_level: str | None = None  # 'BSc' | 'MSc' | 'PhD' | 'PostDoc' | 'N/A'
    funding_type: str | None = None  # 'Fully Funded' | 'Full Tuition + Stipend' | 'Partially Funded' | 'Paid' | 'Unpaid'
    professor_name: str | None = None
    lab_name: str | None = None
    lab_website: str | None = None
    research_domain: str | None = None  # e.g., 'AI/ML', 'Robotics', 'IoT', 'Bioinformatics'
    stipend_amount: str | None = None
    requirements: str | None = None
    
    # Metadata
    posted_date: str | None = None
    keyword: str | None = None
    description: str = ""
    scraped_date: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def normalized_link(self) -> str:
        return normalize_link(self.link)

    def as_record(self) -> dict[str, object]:
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "company": self.institution_or_company,
            "institution_or_company": self.institution_or_company,
            "location": self.location,
            "country": self.country,
            "link": self.normalized_link(),
            "source": self.source,
            "deadline": self.deadline,
            "status": self.status,
            "degree_level": self.degree_level,
            "funding_type": self.funding_type,
            "professor_name": self.professor_name,
            "lab_name": self.lab_name,
            "lab_website": self.lab_website,
            "research_domain": self.research_domain,
            "stipend_amount": self.stipend_amount,
            "requirements": self.requirements,
            "posted_date": self.posted_date,
            "keyword": self.keyword,
            "description": self.description,
            "scraped_date": self.scraped_date,
        }


# Backward compatibility
@dataclass
class Internship(Opportunity):
    def __init__(
        self,
        title: str,
        company: str,
        location: str,
        link: str,
        source: str,
        posted_date: str | None = None,
        description: str = "",
        keyword: str | None = None,
        deadline: str | None = None,
        status: str = "Open",
        **kwargs,
    ):
        super().__init__(
            category="internship",
            title=title,
            institution_or_company=company,
            location=location,
            link=link,
            source=source,
            posted_date=posted_date,
            description=description,
            keyword=keyword,
            deadline=deadline,
            status=status,
            **kwargs,
        )

    @property
    def company(self) -> str:
        return self.institution_or_company

    @company.setter
    def company(self, val: str):
        self.institution_or_company = val
