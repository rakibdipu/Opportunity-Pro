create extension if not exists pgcrypto;

-- ── OPPORTUNITIES TABLE (Supports Internships, RA Positions & Funded Grad Studies) ──
create table if not exists opportunities (
    id uuid primary key default gen_random_uuid(),
    category text not null default 'internship' check (category in ('internship', 'ra', 'masters_phd')),
    title text not null,
    institution_or_company text not null,
    company text, -- alias for backwards compatibility
    location text,
    country text,
    link text not null,
    source text not null,
    deadline text,
    status text not null default 'Open', -- 'Upcoming', 'Open', 'Closes Soon', 'Rolling'
    
    -- Academic & Research Specific Fields
    degree_level text, -- 'BSc', 'MSc', 'PhD', 'PostDoc', 'N/A'
    funding_type text, -- 'Fully Funded', 'Full Tuition + Stipend', 'Partially Funded', 'Paid', 'Unpaid'
    professor_name text,
    lab_name text,
    lab_website text,
    research_domain text,
    stipend_amount text,
    requirements text,
    
    -- Search & Metadata
    keyword text,
    description text,
    posted_date text,
    scraped_date timestamptz not null default now()
);

create unique index if not exists opportunities_link_unique_idx
    on opportunities (link);

create index if not exists opportunities_category_idx
    on opportunities (category);

create index if not exists opportunities_scraped_date_idx
    on opportunities (scraped_date desc);

-- Backward compatibility table alias / legacy table
create table if not exists internships (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    company text not null,
    location text,
    link text not null,
    source text not null,
    keyword text,
    posted_date text,
    scraped_date timestamptz not null default now()
);

create unique index if not exists internships_link_unique_idx
    on internships (link);

create table if not exists profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    email text not null,
    full_name text,
    interest_area text,
    experience_level text,
    university text,
    resume_text text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists saved_jobs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    internship_id uuid references opportunities(id) on delete cascade,
    opportunity_id uuid references opportunities(id) on delete cascade,
    item_title text,
    item_company text,
    item_category text default 'internship',
    item_link text,
    status text not null default 'Saved' check (status in ('Saved', 'Applied', 'Interviewing', 'Accepted', 'Rejected')),
    created_at timestamptz default now()
);

create index if not exists saved_jobs_user_id_idx on saved_jobs(user_id);

alter table profiles enable row level security;
alter table saved_jobs enable row level security;
alter table opportunities enable row level security;

create policy "Opportunities are public to read" on opportunities
    for select using (true);

create policy "Users can read their own profile" on profiles
    for select using (auth.uid() = id);

create policy "Users can update their own profile" on profiles
    for update using (auth.uid() = id);

create policy "Users can insert their own profile" on profiles
    for insert with check (auth.uid() = id);

create policy "Users can read their own saved jobs" on saved_jobs
    for select using (auth.uid() = user_id);

create policy "Users can insert their own saved jobs" on saved_jobs
    for insert with check (auth.uid() = user_id);

create policy "Users can delete their own saved jobs" on saved_jobs
    for delete using (auth.uid() = user_id);

