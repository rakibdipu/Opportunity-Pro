# OpportunityRadar Pro

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python">
  <img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Supabase-Database-3ECF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Gemini_AI-3--in--1_Suite-8E75B2?style=flat-square&logo=google&logoColor=white" alt="AI Suite">
  <img src="https://img.shields.io/badge/HTML-Frontend-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML">
  <img src="https://img.shields.io/badge/CSS-Frontend-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS">
  <img src="https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JS">
  <img src="https://img.shields.io/badge/License-MIT-4CAF50?style=flat-square" alt="License">
</p>

<p align="center">
  Unified Global Intelligence Platform for <strong>Upcoming Internships</strong>, <strong>Research Assistant (RA) Positions</strong>, and <strong>Fully Funded Masters & PhD Scholarships</strong> with built-in 3-in-1 Gemini AI Document Generator.
</p>

---

## 🎯 What's New & Upgraded

1. 🚀 **Upcoming Internships Track**: Real-time monitoring of upcoming and open global tech, embedded, SWE, and regional internships with stipend details and direct application portals.
2. 🔬 **Research Assistant (RA) Openings**: World-class lab openings (MIT, Stanford, Oxford, NUS, ETH Zurich, U of Toronto) with Professor names, research domains, funding, and direct contact portals.
3. 🏛️ **Funded Masters & PhD Scholarships Hub**: Merged with **Scholarship Tracker Pro** — complete database of 35+ fully funded scholarships (Erasmus Mundus, DAAD, MEXT, Fulbright, Singa, KAUST, Chevening, etc.) with match score ratings, eligibility, and benefits.
4. 🤖 **3-in-1 AI Career & Academic Suite**:
   - **AI Cover Letter Generator** (for Internships & Jobs)
   - **AI Professor Cold Email Generator** (tailored for RA positions with candidate resume alignment)
   - **AI Statement of Purpose (SOP) / Motivation Letter Generator** (for Masters & PhD programs)
5. 📋 **Application Kanban Pipeline**: Manage Saved, Applied, Interviewing, Accepted, and Rejected applications with status tracking.
6. 📊 **Interactive Analytics**: Real-time insights by track, country, research domain, and funding breakdown using Chart.js.

---

## 🏗️ System Architecture

**Data Flow:**
1. Frontend dynamically fetches opportunities via `/opportunities?category=internship|ra|masters_phd`.
2. Backend searches Supabase database or serves rich real-time curated datasets from top university labs and scholarship boards.
3. Users can bookmark listings, review detailed eligibility & benefits in popups, track status in Kanban, and export to CSV.
4. Integrated Gemini AI generates personalized Cover Letters, Cold Emails, and SOP drafts based on the applicant's resume.

---

## 📂 Project Structure

```
Opportunity-Pro/
├── backend/
│   ├── main.py                  # FastAPI Application & AI Generator Routes
│   ├── models.py                # Opportunity & Internship Dataclasses
│   ├── seed_data.py             # 45+ Curated Multi-Track Dataset
│   ├── sources.py               # Aggregation & Web Scrapers
│   ├── supabase_client.py       # Supabase Database Client
│   ├── keyword_filter.py        # Smart keyword matching engine
│   └── schema.sql               # PostgreSQL Database Schema
├── frontend/
│   ├── index.html               # Main Multi-Track Portal Dashboard
│   ├── app.js                   # Client Logic, Filtering, AI Suite, Kanban
│   ├── styles.css               # Modern Responsive Theme & Badges
│   ├── config.js                # API Base URL & Supabase Configuration
│   ├── login.html               # Authentication Login
│   └── signup.html              # Registration Form
├── main.py                      # Daily Scheduled Scraper Runner
├── render.yaml                  # Render Infrastructure as Code Blueprint
├── requirements.txt             # Python Dependencies
└── README.md                    # Documentation
```

---

## 🛠️ Technology Stack

### Backend
| Tool | Purpose |
| :--- | :--- |
| **FastAPI** | High-performance REST API |
| **Python 3.11+** | Backend scripting & data parsing |
| **Uvicorn** | ASGI server |
| **Render** | Cloud hosting (`https://internradar-backend-4x63.onrender.com`) |

### Frontend
| Tool | Purpose |
| :--- | :--- |
| **HTML5 / CSS3** | Dynamic responsive portal with CSS variables |
| **Vanilla JavaScript** | Asynchronous API fetching & state management |
| **Chart.js** | Interactive analytics data visualizations |
| **Netlify** | Global edge hosting with automated deploys |

### Database & AI
| Tool | Purpose |
| :--- | :--- |
| **Supabase** | PostgreSQL database with Row Level Security |
| **Gemini AI** | 3-in-1 Cover Letter, Professor Cold Email & SOP generator |

---

## 🚀 Deployment

- **Backend API (Render):** `https://internradar-backend-4x63.onrender.com`
- **Interactive Swagger Docs:** `https://internradar-backend-4x63.onrender.com/docs`
- **GitHub Repository:** `https://github.com/rakibdipu/Opportunity-Pro`

---

## 👤 Author

**Rakib Dipu**  
- **GitHub:** [https://github.com/rakibdipu](https://github.com/rakibdipu)  
- **Repository:** [https://github.com/rakibdipu/Opportunity-Pro](https://github.com/rakibdipu/Opportunity-Pro)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
