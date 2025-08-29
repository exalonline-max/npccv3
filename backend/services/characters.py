import json
from ..db import SessionLocal
from ..models import Character


def pack_character_data(obj):
    try:
        return json.dumps(obj)
    except Exception:
        return '{}'


def unpack_character_data(text):
    try:
        return json.loads(text) if text else {}
    except Exception:
        return {}


def db_get_characters_for_campaign(cid):
    s = SessionLocal()
    try:
        return s.query(Character).filter(Character.campaign_id == cid).all()
    finally:
        s.close()


def db_create_character(campaign_id, user_id, name, data_blob):
    s = SessionLocal()
    try:
        c = Character(campaign_id=campaign_id, user_id=user_id, name=name, data=data_blob)
        s.add(c)
        s.commit()
        s.refresh(c)
        return c
    finally:
        s.close()
