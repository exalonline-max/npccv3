from ..db import SessionLocal
from ..models import Message


def db_create_message(campaign_id, author, text):
    s = SessionLocal()
    try:
        import uuid as _uuid
        ts = __import__('datetime').datetime.utcnow().isoformat()
        m = Message(campaign_id=campaign_id, author=author, text=text, timestamp=ts)
        try:
            m.uuid = str(_uuid.uuid4())
        except Exception:
            pass
        s.add(m)
        s.commit()
        s.refresh(m)
        return m
    finally:
        s.close()


def db_get_messages_for_campaign(cid):
    s = SessionLocal()
    try:
        return s.query(Message).filter(Message.campaign_id == cid).order_by(Message.id.asc()).all()
    finally:
        s.close()
