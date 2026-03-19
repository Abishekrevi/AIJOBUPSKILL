import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Boolean, ForeignKey
from datetime import datetime
import enum

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./pivotpath.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

class Worker(Base):
    __tablename__ = "workers"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=True)
    current_role = Column(String)
    current_salary = Column(Float)
    target_role = Column(String)
    skills_summary = Column(Text)
    status = Column(String, default="onboarding")
    isa_signed = Column(Boolean, default=False)
    isa_signed_at = Column(DateTime, nullable=True)
    progress_pct = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    hr_company_id = Column(String, ForeignKey("hr_companies.id"), nullable=True)

class HRCompany(Base):
    __tablename__ = "hr_companies"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    industry = Column(String)
    contact_name = Column(String)
    contact_email = Column(String)
    password_hash = Column(String, nullable=True)
    workers_enrolled = Column(Integer, default=0)
    contract_value = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class SkillSignal(Base):
    __tablename__ = "skill_signals"
    id = Column(String, primary_key=True)
    skill_name = Column(String, nullable=False)
    category = Column(String)
    demand_score = Column(Float)
    growth_rate = Column(Float)
    avg_salary_uplift = Column(Float)
    top_employers = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow)

class Credential(Base):
    __tablename__ = "credentials"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    provider = Column(String)
    duration_weeks = Column(Integer)
    cost_usd = Column(Float)
    skills_taught = Column(Text)
    demand_score = Column(Float)
    employer_endorsed = Column(Boolean, default=False)
    placement_rate = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

class WorkerCredential(Base):
    __tablename__ = "worker_credentials"
    id = Column(String, primary_key=True)
    worker_id = Column(String, ForeignKey("workers.id"))
    credential_id = Column(String, ForeignKey("credentials.id"))
    status = Column(String, default="not_started")
    progress_pct = Column(Integer, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

class CoachSession(Base):
    __tablename__ = "coach_sessions"
    id = Column(String, primary_key=True)
    worker_id = Column(String, ForeignKey("workers.id"))
    message = Column(Text)
    response = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class Employer(Base):
    __tablename__ = "employers"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    industry = Column(String)
    open_roles = Column(Text)
    skills_needed = Column(Text)
    interview_slots = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class InterviewBooking(Base):
    __tablename__ = "interview_bookings"
    id = Column(String, primary_key=True)
    worker_id = Column(String, ForeignKey("workers.id"))
    employer_id = Column(String, ForeignKey("employers.id"))
    slot_date = Column(String)
    slot_time = Column(String)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

class GigPost(Base):
    __tablename__ = "gig_posts"
    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    company = Column(String)
    skills_needed = Column(Text)
    duration_weeks = Column(Integer)
    rate_per_day = Column(Float)
    remote = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_data()

async def seed_data():
    import json, uuid
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        result = await db.execute(select(SkillSignal).limit(1))
        if result.scalar():
            return

        signals = [
            SkillSignal(id=str(uuid.uuid4()), skill_name="Prompt Engineering", category="AI/ML", demand_score=94, growth_rate=87, avg_salary_uplift=22000, top_employers=json.dumps(["OpenAI", "Anthropic", "Microsoft", "Google"])),
            SkillSignal(id=str(uuid.uuid4()), skill_name="Data Analysis (Python)", category="Data", demand_score=89, growth_rate=34, avg_salary_uplift=18000, top_employers=json.dumps(["Meta", "Amazon", "JPMorgan", "Deloitte"])),
            SkillSignal(id=str(uuid.uuid4()), skill_name="AI Product Management", category="Product", demand_score=91, growth_rate=62, avg_salary_uplift=25000, top_employers=json.dumps(["Salesforce", "HubSpot", "Stripe", "Figma"])),
            SkillSignal(id=str(uuid.uuid4()), skill_name="LLM Fine-tuning", category="AI/ML", demand_score=86, growth_rate=120, avg_salary_uplift=30000, top_employers=json.dumps(["Scale AI", "Cohere", "Mistral", "Databricks"])),
            SkillSignal(id=str(uuid.uuid4()), skill_name="Business Intelligence", category="Data", demand_score=82, growth_rate=28, avg_salary_uplift=15000, top_employers=json.dumps(["Airbnb", "Lyft", "Shopify", "Twilio"])),
            SkillSignal(id=str(uuid.uuid4()), skill_name="AI Ethics & Compliance", category="Policy", demand_score=78, growth_rate=95, avg_salary_uplift=19000, top_employers=json.dumps(["IBM", "Accenture", "HSBC"])),
            SkillSignal(id=str(uuid.uuid4()), skill_name="MLOps / Model Deployment", category="AI/ML", demand_score=88, growth_rate=55, avg_salary_uplift=27000, top_employers=json.dumps(["Netflix", "Uber", "Spotify", "Palantir"])),
        ]
        credentials = [
            Credential(id=str(uuid.uuid4()), title="AI for Business Professionals", provider="Coursera / DeepLearning.AI", duration_weeks=6, cost_usd=299, demand_score=91, skills_taught=json.dumps(["Prompt Engineering", "AI Product Management"]), employer_endorsed=True, placement_rate=0.74),
            Credential(id=str(uuid.uuid4()), title="Python for Data Analysis", provider="DataCamp", duration_weeks=10, cost_usd=399, demand_score=87, skills_taught=json.dumps(["Data Analysis (Python)", "Business Intelligence"]), employer_endorsed=True, placement_rate=0.69),
            Credential(id=str(uuid.uuid4()), title="LLM Engineering Bootcamp", provider="Maven", duration_weeks=8, cost_usd=1499, demand_score=93, skills_taught=json.dumps(["LLM Fine-tuning", "MLOps / Model Deployment", "Prompt Engineering"]), employer_endorsed=True, placement_rate=0.81),
            Credential(id=str(uuid.uuid4()), title="AI Product Management Certificate", provider="Reforge", duration_weeks=12, cost_usd=2495, demand_score=89, skills_taught=json.dumps(["AI Product Management", "Prompt Engineering"]), employer_endorsed=True, placement_rate=0.77),
            Credential(id=str(uuid.uuid4()), title="Responsible AI & Ethics", provider="MIT xPRO", duration_weeks=6, cost_usd=999, demand_score=76, skills_taught=json.dumps(["AI Ethics & Compliance"]), employer_endorsed=False, placement_rate=0.61),
        ]
        employers_list = [
            Employer(id=str(uuid.uuid4()), name="Stripe", industry="FinTech", open_roles=json.dumps(["AI PM", "Data Analyst", "ML Engineer"]), skills_needed=json.dumps(["AI Product Management", "Data Analysis (Python)", "LLM Fine-tuning"]), interview_slots=12),
            Employer(id=str(uuid.uuid4()), name="Salesforce", industry="SaaS", open_roles=json.dumps(["AI Solutions Engineer", "Product Manager"]), skills_needed=json.dumps(["Prompt Engineering", "AI Product Management"]), interview_slots=8),
            Employer(id=str(uuid.uuid4()), name="Deloitte", industry="Consulting", open_roles=json.dumps(["AI Consultant", "Data Analyst"]), skills_needed=json.dumps(["AI Ethics & Compliance", "Data Analysis (Python)"]), interview_slots=15),
        ]
        gigs = [
            GigPost(id=str(uuid.uuid4()), title="AI Strategy Consultant", company="McKinsey Digital", skills_needed=json.dumps(["AI Product Management", "Prompt Engineering"]), duration_weeks=8, rate_per_day=650, remote=True),
            GigPost(id=str(uuid.uuid4()), title="Data Analysis Lead", company="Accenture", skills_needed=json.dumps(["Data Analysis (Python)", "Business Intelligence"]), duration_weeks=12, rate_per_day=550, remote=True),
            GigPost(id=str(uuid.uuid4()), title="LLM Integration Specialist", company="Capgemini", skills_needed=json.dumps(["LLM Fine-tuning", "Prompt Engineering"]), duration_weeks=6, rate_per_day=700, remote=False),
            GigPost(id=str(uuid.uuid4()), title="AI Ethics Reviewer", company="HSBC", skills_needed=json.dumps(["AI Ethics & Compliance"]), duration_weeks=4, rate_per_day=500, remote=True),
        ]
        db.add_all(signals + credentials + employers_list + gigs)
        await db.commit()
