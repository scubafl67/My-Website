from sqlalchemy import create_engine, Column, String, Float, Integer, JSON, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timezone

Base = declarative_base()


class TeammateProfile(Base):
    __tablename__ = "teammates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    role = Column(String, default="")
    domain = Column(String, default="nerc_cip")
    iq_score = Column(Float, default=0.0)
    iq_per_standard = Column(JSON, default=dict)
    iq_history = Column(JSON, default=list)
    strengths = Column(JSON, default=list)
    gaps = Column(JSON, default=list)
    interaction_count = Column(Integer, default=0)
    pattern_data = Column(JSON, default=dict)
    baseline_completed = Column(Integer, default=0)
    escalation_contact = Column(String, default="")
    confidence_per_standard = Column(JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_interaction = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class InteractionLog(Base):
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teammate_id = Column(String, nullable=False)
    domain = Column(String, default="nerc_cip")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    topic_standard = Column(String)
    question_summary = Column(String)
    option_chosen = Column(String)
    reasoning_quality = Column(String)
    iq_delta = Column(Float, default=0.0)
    source_used = Column(String)
    source_type = Column(String, default="")
    source_detail = Column(String, default="")
    standard_cited = Column(String, default="")
    reasoning_depth = Column(String, default="")
    cross_standard_awareness = Column(Integer, default=0)
    missed_implications = Column(JSON, default=list)
    comprehension_confirmed = Column(Integer, default=0)
    comprehension_attempts = Column(Integer, default=0)
