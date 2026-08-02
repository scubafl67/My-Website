from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from profiles.models import Base, TeammateProfile, InteractionLog
from datetime import datetime, timezone
from config.settings import DATABASE_URL


class TeammateStore:
    def __init__(self, db_url: str = None):
        self.engine = create_engine(db_url or DATABASE_URL)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def get_or_create(self, teammate_id: str, name: str = None, domain: str = "nerc_cip") -> dict:
        session = self.Session()
        try:
            profile = session.query(TeammateProfile).filter_by(id=teammate_id).first()
            if not profile:
                profile = TeammateProfile(
                    id=teammate_id,
                    name=name or teammate_id,
                    domain=domain,
                    iq_score=0.0,
                    iq_per_standard={},
                    iq_history=[],
                    strengths=[],
                    gaps=[],
                    interaction_count=0,
                    pattern_data={},
                )
                session.add(profile)
                session.commit()
            return self._to_dict(profile)
        finally:
            session.close()

    def get(self, teammate_id: str) -> dict:
        session = self.Session()
        try:
            profile = session.query(TeammateProfile).filter_by(id=teammate_id).first()
            if not profile:
                return {}
            return self._to_dict(profile)
        finally:
            session.close()

    def update(self, teammate_id: str, **kwargs) -> dict:
        session = self.Session()
        try:
            profile = session.query(TeammateProfile).filter_by(id=teammate_id).first()
            if not profile:
                return {}
            for key, value in kwargs.items():
                if hasattr(profile, key):
                    setattr(profile, key, value)
            profile.last_interaction = datetime.now(timezone.utc)
            session.commit()
            return self._to_dict(profile)
        finally:
            session.close()

    def increment_interaction(self, teammate_id: str) -> None:
        session = self.Session()
        try:
            profile = session.query(TeammateProfile).filter_by(id=teammate_id).first()
            if profile:
                profile.interaction_count += 1
                profile.last_interaction = datetime.now(timezone.utc)
                session.commit()
        finally:
            session.close()

    def log_interaction(self, teammate_id: str, domain: str, **kwargs) -> None:
        session = self.Session()
        try:
            log = InteractionLog(teammate_id=teammate_id, domain=domain, **kwargs)
            session.add(log)
            session.commit()
        finally:
            session.close()

    def _to_dict(self, profile: TeammateProfile) -> dict:
        return {
            "id": profile.id,
            "name": profile.name,
            "role": profile.role,
            "domain": profile.domain,
            "iq_score": profile.iq_score,
            "iq_per_standard": profile.iq_per_standard or {},
            "iq_history": profile.iq_history or [],
            "strengths": profile.strengths or [],
            "gaps": profile.gaps or [],
            "interaction_count": profile.interaction_count,
            "pattern_data": profile.pattern_data or {},
            "baseline_completed": profile.baseline_completed or 0,
            "escalation_contact": profile.escalation_contact or "",
            "confidence_per_standard": profile.confidence_per_standard or {},
            "created_at": str(profile.created_at),
            "last_interaction": str(profile.last_interaction),
        }
