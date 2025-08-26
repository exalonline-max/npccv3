Provisioning Upstash (quick guide)
================================

This guide shows how to create a free Upstash Redis database and wire it into this project.

1) Create an Upstash account

   - Visit https://upstash.com and sign up for a free account.

2) Create a Redis database

   - In the Upstash console, create a new Redis database (Free plan is available).
   - Choose a name and region, then create the database.

3) Retrieve the connection URI

   - In the database details page you'll see two useful connection options:
     - Redis URI (recommended for redis-py / python clients): rediss://:PASSWORD@HOST:PORT
     - REST API endpoint (Upstash also supports a REST API with token-based auth)

   - Copy the Redis URI (it will include the password). It usually looks like:

       rediss://:abcd1234@us1-upstash.redis.upstash.io:6379

4) Configure Render (or your environment)

   - In Render, go to your backend service settings -> Environment -> Environment Variables.
   - Add a variable:
       - Key: REDIS_URL
       - Value: <your rediss://... URI from Upstash>

   - Deploy/redeploy the backend service. The backend reads `REDIS_URL` and will use it as the Socket.IO message queue.

5) Test the connection from this repo

   - Locally, set the env var and run the test script included in this repo:

       export REDIS_URL="rediss://:yourpassword@your-host:6379"
       python3 backend/test_redis.py

   - On Render, after deploy you can open the backend logs and search for the test output (if you run the script there) or use remote debugging.

Security and notes

 - Keep the URI secret (it encodes the password). Store it as an environment variable in Render or your CI.
 - Use the TLS rediss:// URI when provided by Upstash.
 - Upstash has a free tier with limits — fine for testing and small demos.

If you want, I can provision Upstash for you (I can't create the account on your behalf), or walk you through the Render dashboard steps and verify once you paste the `REDIS_URL` here.
