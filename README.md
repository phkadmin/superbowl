# Super Bowl Betting Board

Local web app for collecting Super Bowl prop-bet responses, calculating payment owed per entry, showing shared results, and providing an admin payout tracker.

## Run

```bash
cd "/Users/paygecain/Documents/Super Bowl"
python3 server.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Notes

- Admin password: `SOUP`
- Database: SQLite at `/Users/paygecain/Documents/Super Bowl/data/superbowl.db`
- Server binds to `0.0.0.0:8000` for LAN access.
- Replace `/Users/paygecain/Documents/Super Bowl/static/assets/venmo-qr.svg` with your real Venmo QR image (keep same filename or update `index.html`).
- Question 23 was missing a price in the prompt; this implementation treats it as `$1`.
