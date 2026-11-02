---
name: Public founding deadlines
description: Product rule for public founding offer dates and their pricing behavior.
---

# Public founding offer deadlines

For the public founding offer, `?d=YYYY-MM-DD` is the exact deadline. It must be a real Monday; the offer closes at 11:59 PM Eastern on that date. A missing, malformed, non-Monday, or past date means the offer has ended. Never replace a missing or past date with a newly generated deadline. While active, show both annual and monthly founding prices; otherwise show regular prices and regular checkout.

**Why:** the user explicitly requires stale or missing offer links not to extend the discount by silently advancing the deadline.

**How to apply:** keep public page display and checkout selection consistent anywhere the same `?d=` offer is used. Subscriber-specific token offers have their own server-validated deadline and are a separate flow.
