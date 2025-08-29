from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from .db import Base


class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True)
    username = Column(String)
    password_hash = Column(String)
    character = relationship('Character', back_populates='user', uselist=False)


class Campaign(Base):
    __tablename__ = 'campaigns'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    name = Column(String)
    owner = Column(Integer)
    invite_code = Column(String)
    characters = relationship('Character', back_populates='campaign')


class Membership(Base):
    __tablename__ = 'memberships'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    role = Column(String)


class Character(Base):
    __tablename__ = 'characters'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    name = Column(String)
    maxHp = Column(Integer)
    portrait = Column(Text)
    data = Column(Text)
    user = relationship('User', back_populates='character')
    campaign = relationship('Campaign', back_populates='characters')


class Message(Base):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    author = Column(String)
    text = Column(Text)
    timestamp = Column(String)
