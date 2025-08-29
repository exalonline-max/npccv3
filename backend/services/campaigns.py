import datetime
import uuid as _uuid
from ..db import SessionLocal
from ..models import Campaign, Membership
from ..utils.ids import is_int_like


def db_create_campaign(name, owner_id, invite_code=None):
    s = SessionLocal()
    try:
        ic = invite_code or f"INV-{int(datetime.datetime.utcnow().timestamp()) % 100000:05d}"
        c = Campaign(name=name, owner=owner_id, invite_code=ic, uuid=str(_uuid.uuid4()))
        s.add(c)
        s.commit()
        s.refresh(c)
        return c
    finally:
        s.close()


def db_get_campaign_by_name(name):
    s = SessionLocal()
    try:
        return s.query(Campaign).filter(Campaign.name == name).first()
    finally:
        s.close()


def db_get_campaign_by_id(cid):
    s = SessionLocal()
    try:
        return s.query(Campaign).filter(Campaign.id == cid).first()
    finally:
        s.close()


def db_get_campaigns_for_user(uid):
    s = SessionLocal()
    try:
        mids = s.query(Membership).filter(Membership.user_id == uid).all()
        camp_ids = [m.campaign_id for m in mids if getattr(m, 'campaign_id', None) is not None]
        if not camp_ids:
            return []
        camps = s.query(Campaign).filter(Campaign.id.in_(camp_ids)).all()
        return camps
    finally:
        s.close()


def db_create_membership(campaign_id, user_id, role='player'):
    s = SessionLocal()
    try:
        m = Membership(campaign_id=campaign_id, user_id=user_id, role=role, uuid=str(_uuid.uuid4()))
        s.add(m)
        s.commit()
        s.refresh(m)
        return m
    finally:
        s.close()


def resolve_campaign_id(val):
    # Accept integer ids as ints, otherwise return as-is for UUID or name
    if is_int_like(val):
        return int(val)
    return val
