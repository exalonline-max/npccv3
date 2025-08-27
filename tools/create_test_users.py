#!/usr/bin/env python3
"""Create test users and have them join the Test Campaign.

Usage: python tools/create_test_users.py --count 3 --api https://npcchatter-backend.onrender.com
"""
import sys
import argparse
import urllib.request
import urllib.error
import json

def _do_post(url, data=None, headers=None, timeout=10):
    body = json.dumps(data).encode('utf8') if data is not None else None
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('Content-Type', 'application/json')
    if headers:
        for k,v in headers.items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode('utf8')
            return resp.status, text
    except urllib.error.HTTPError as e:
        try:
            return e.code, e.read().decode('utf8')
        except Exception:
            return e.code, str(e)
    except Exception as e:
        return None, str(e)

def register(api_base, email, username, password='Password123!'):
    url = api_base.rstrip('/') + '/api/auth/register'
    return _do_post(url, {'email': email, 'username': username, 'password': password})

def join_test(api_base, token):
    url = api_base.rstrip('/') + '/api/campaigns/test/join'
    headers = {'Authorization': f'Bearer {token}'}
    return _do_post(url, None, headers)

def login(api_base, email, password='Password123!'):
    url = api_base.rstrip('/') + '/api/auth/login'
    return _do_post(url, {'email': email, 'password': password})

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--count', type=int, default=3)
    p.add_argument('--api', type=str, default='https://npcchatter-backend.onrender.com')
    args = p.parse_args()

    created = []
    for i in range(args.count):
        email = f'testuser{i+1}+auto@example.com'
        username = f'testuser{i+1}'
        print(f'Registering {email} ...', end=' ', flush=True)
        status, text = register(args.api, email, username)
        if status in (200,201):
            try:
                token = json.loads(text).get('token')
            except Exception:
                token = None
            if token:
                print('ok, token received:', token[:40] + '...')
                created.append((email, username, token))
            else:
                print('registered but no token in response:', text[:200])
        else:
            # If email already exists, try to login and use that token
            try:
                js = json.loads(text)
            except Exception:
                js = {}
            if status == 400 and js.get('message','').lower().find('email') != -1:
                print('email exists, trying login...', end=' ', flush=True)
                st2, txt2 = login(args.api, email)
                if st2 in (200,):
                    try:
                        token = json.loads(txt2).get('token')
                    except Exception:
                        token = None
                    if token:
                        print('login ok, token:', token[:40] + '...')
                        created.append((email, username, token))
                        continue
                print('login failed', st2, txt2[:300])
            else:
                print('failed', status, text[:300])

    for email, username, token in created:
        print(f'Joining test campaign as {username} ...', end=' ', flush=True)
        status, text = join_test(args.api, token)
        if status == 200:
            try:
                js = json.loads(text)
                print('joined', js.get('name') or js.get('id'))
            except Exception:
                print('joined (non-JSON response)')
        else:
            print('failed', status, text[:300])

if __name__ == '__main__':
    main()
