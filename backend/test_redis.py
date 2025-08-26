import os
import sys
import redis

def main():
    url = os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI')
    if not url:
        print('REDIS_URL not set')
        sys.exit(2)
    try:
        r = redis.from_url(url, socket_timeout=5)
        pong = r.ping()
        print('PING ->', pong)
    except Exception as e:
        print('Redis connection failed:', e)
        sys.exit(1)

if __name__ == '__main__':
    main()
