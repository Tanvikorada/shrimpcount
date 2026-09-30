# What quality a business of this size will expect (an honest view, 2026-09-21)

A hatchery selling postlarvae worth crores does not judge software the way a consumer does. In rough order of what decides
whether they trust it:

1. **The count is right, and they can prove it.** Their revenue is counted PL, and a disagreement with a farm is a money dispute.
   A 5% miscount on a 50-lakh batch is a real amount. So: accuracy measured against careful hand counts, and documents that
   show what was counted. **We have neither measured accuracy nor a track record yet.** The evidence photo and report are built;
   the accuracy number needs the field test (docs/field-test-plan.md).
2. **It never loses records and works when the signal drops.** Offline counting works. Cloud backup, accounts, team sharing and
   new-phone restore are now built and tested against a stand-in server, and switch on when a Supabase project is connected
   (docs/cloud-setup.md). **Until then records live on one phone**, and a lost or reset phone loses the history. Not yet tested
   against a real Supabase project.
3. **Staff can use it without training.** Large targets, plain words, four languages, a text-size control. Untested on real
   staff; the Telugu, Hindi and Tamil wording is a draft that needs a native speaker.
4. **The documents look official.** The count report, delivery certificate and invoice share one design: logo, document number,
   plain statements, the marked photos as evidence, and signature lines (the certificate has one for the customer receiving the
   delivery). The invoice shows the amount in words in Indian style and a PAID / BALANCE DUE stamp. Not yet: tax fields (we
   do not guess what tax applies), a QR code that lets a customer verify a document (needs a server), Telugu/Hindi/Tamil versions.
5. **The supplier is dependable.** Support, a named person to call, data ownership and privacy terms, uptime. Not built.
6. **Then visual polish.** It matters for first impressions and trust, and it is the part this project can improve fastest.

## Where we honestly stand on the look

Clean, modern and consistent, and above the typical agri-tech app. It is **not yet at the level of a large company's product**,
which comes from a design team, a brand system, custom illustration and icons, and months of testing on real phones. Missing:
a designed brand (the logo mark is a first version), custom iconography and illustrations, dark mode, a tablet and desktop
layout, a full accessibility check, and testing on real budget Android phones in hatchery light.

## What "enterprise" adds that is not visual

Login and users with roles, cloud sync and backup, an audit trail on edited counts, an admin view across tanks and staff,
data export, security review, uptime and support commitments. None of this is built.

## A realistic bar for a pilot

For a pilot, a hatchery expects: it counts a tray they know within a tolerance they trust (their own cross-check is a few
percent), it is quicker than counting by hand, staff can use it, and the reports are presentable. Meeting that is achievable.
Meeting "enterprise" is a further, larger step and should follow a successful pilot, not precede it.
