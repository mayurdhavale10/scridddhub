# Ownership chain from the 7/12 and mutation entries

**Status:** parked 2026-10-01, waiting on the owner.

## What it is
On the Legal & RERA Check screen, the Ownership Chain should list every transfer of the land
from the earliest record to today (allotment, sale, inheritance/varas, gift, partition, bank
charge, court order, NA conversion), ending in "traced back N years, uncontested".

## Why it isn't automatic
The chain comes from the 7/12 extract (Satbara) and the mutation register (Ferfar). Bhulekh
(bhulekh.mahabhumi.gov.in) has a captcha on every lookup and digital 7/12 needs a login and
payment, so we don't fetch them. Sellers hand these papers over in every deal anyway.

## Plan
1. Upload a photo or PDF of the 7/12 and mutation entries on the Legal Check screen.
2. AI reads the Marathi entries and drafts each chain step: date, type, from → to, mutation
   number, and whether it was certified.
3. Each drafted step is marked "draft" until a person confirms it (AI drafts, human signs).
4. Add a step type field to ownership_chain entries (today they're free text).

## Needed from the owner
- One real 7/12 extract and its mutation entries (Ferfar) for a real parcel: from a seller,
  or downloaded from Bhulekh by typing the captcha yourself. Then build and test against it.
