-- ============================================================================
-- Replit → new Supabase data migration
-- ============================================================================
-- Run in: Supabase SQL editor (Project → SQL Editor → New query → paste → Run)
-- Safe to re-run: the partner UPSERT updates on conflict; the lead and
-- bot_emails inserts are guarded by NOT EXISTS so duplicate runs are no-ops.
-- Bcrypt password hashes are inserted AS-IS. Do not re-hash.
-- ============================================================================
--
-- Source export: 2026-06-14T23:48:18Z  (1 partner, 1 lead, 25 bot_emails)
--
-- Prereqs: migrations 0001-0009 have all been applied to this database.
-- ============================================================================

DO $$
DECLARE
  v_partner_id integer;
  v_lead_id integer;
BEGIN
  -- ─── 1) Partner upsert by email ──────────────────────────────────────────
  INSERT INTO partners (
    email,
    password,                       -- bcrypt hash, inserted AS-IS
    name,
    slug,
    subscription_status,
    is_admin,
    enrollment_link,
    email_notifications,
    tone_profile,
    coaching_minimal,
    daily_ai_calls,
    daily_regenerations,
    created_at
  ) VALUES (
    'admin@example.com',
    '$2b$10$sMdKfTp2Pwmz.LWXy.AkSuMb8MLRqDrraIV0m5iCHP.050TzMRlgq',
    'Admin',
    'admin',
    'active',
    true,
    'https://www.zinzino.com/shop/2019713973/US/en-gb/enrollmentshop/partner-offers',
    true,
    'friendly',
    false,
    0,
    0,
    '2026-01-28 14:30:03.934252+00'::timestamptz
  )
  ON CONFLICT (email) DO UPDATE SET
    password            = EXCLUDED.password,
    name                = EXCLUDED.name,
    slug                = EXCLUDED.slug,
    subscription_status = EXCLUDED.subscription_status,
    is_admin            = EXCLUDED.is_admin,
    enrollment_link     = EXCLUDED.enrollment_link,
    tone_profile        = EXCLUDED.tone_profile
  RETURNING id INTO v_partner_id;

  RAISE NOTICE 'Partner upserted: id=%', v_partner_id;

  -- ─── 2) Lead upsert by (partner_id, lower(email)) ────────────────────────
  SELECT id INTO v_lead_id
  FROM leads
  WHERE partner_id = v_partner_id
    AND email = 'chris@gee4inc.com'
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO leads (
      partner_id, name, email, phone,
      current_work, future_vision, best_time,
      status, notes, bot_paused,
      created_at
    ) VALUES (
      v_partner_id,
      'Chris gee',
      'chris@gee4inc.com',
      '4052015869',
      'Police officer',
      'Rich I want to win big ',
      'evening',
      'new',
      '',
      false,
      '2026-01-28 13:53:08.841572+00'::timestamptz
    )
    RETURNING id INTO v_lead_id;
    RAISE NOTICE 'Lead inserted: id=%', v_lead_id;
  ELSE
    RAISE NOTICE 'Lead already existed: id=%, reusing', v_lead_id;
  END IF;

  -- ─── 3) Bot emails (25 rows). Skip any (lead_id, touch_number, sent_at)
  --        tuple already present so this is re-runnable. The first 20 were
  --        failed empty sends; the last 5 are the successful warm sequence.
  INSERT INTO bot_emails (
    lead_id, partner_id, touch_number, lead_type, subject, body, status, sent_at
  )
  SELECT new_rows.* FROM (VALUES
    -- Failed sequence 1
    (v_lead_id, v_partner_id, 1, 'warm', 'Quick question',           '', 'failed', '2026-03-25 19:58:28.193547+00'::timestamptz),
    (v_lead_id, v_partner_id, 2, 'warm', 'Something worth seeing',   '', 'failed', '2026-03-25 19:59:14.777502+00'::timestamptz),
    (v_lead_id, v_partner_id, 3, 'warm', 'Honest answer',            '', 'failed', '2026-03-25 20:00:00.947606+00'::timestamptz),
    (v_lead_id, v_partner_id, 4, 'warm', 'Still here if you want it','', 'failed', '2026-03-25 20:00:43.291614+00'::timestamptz),
    (v_lead_id, v_partner_id, 5, 'warm', 'Leaving this with you',    '', 'failed', '2026-03-25 20:01:29.083553+00'::timestamptz),
    -- Failed sequence 2
    (v_lead_id, v_partner_id, 1, 'warm', 'Quick question',           '', 'failed', '2026-03-25 20:21:07.336952+00'::timestamptz),
    (v_lead_id, v_partner_id, 2, 'warm', 'Something worth seeing',   '', 'failed', '2026-03-25 20:21:53.736951+00'::timestamptz),
    (v_lead_id, v_partner_id, 3, 'warm', 'Honest answer',            '', 'failed', '2026-03-25 20:22:39.572166+00'::timestamptz),
    (v_lead_id, v_partner_id, 4, 'warm', 'Still here if you want it','', 'failed', '2026-03-25 20:23:23.179656+00'::timestamptz),
    (v_lead_id, v_partner_id, 5, 'warm', 'Leaving this with you',    '', 'failed', '2026-03-25 20:24:07.328969+00'::timestamptz),
    -- Failed sequence 3
    (v_lead_id, v_partner_id, 1, 'warm', 'Quick question',           '', 'failed', '2026-03-26 02:05:04.416839+00'::timestamptz),
    (v_lead_id, v_partner_id, 2, 'warm', 'Something worth seeing',   '', 'failed', '2026-03-26 02:05:50.610758+00'::timestamptz),
    (v_lead_id, v_partner_id, 3, 'warm', 'Honest answer',            '', 'failed', '2026-03-26 02:06:36.560298+00'::timestamptz),
    (v_lead_id, v_partner_id, 4, 'warm', 'Still here if you want it','', 'failed', '2026-03-26 02:07:19.034829+00'::timestamptz),
    (v_lead_id, v_partner_id, 5, 'warm', 'Leaving this with you',    '', 'failed', '2026-03-26 02:08:04.374215+00'::timestamptz),
    -- Failed sequence 4
    (v_lead_id, v_partner_id, 1, 'warm', 'Quick question',           '', 'failed', '2026-03-26 11:38:16.951529+00'::timestamptz),
    (v_lead_id, v_partner_id, 2, 'warm', 'Something worth seeing',   '', 'failed', '2026-03-26 11:39:04.907469+00'::timestamptz),
    (v_lead_id, v_partner_id, 3, 'warm', 'Honest answer',            '', 'failed', '2026-03-26 11:39:50.021565+00'::timestamptz),
    (v_lead_id, v_partner_id, 4, 'warm', 'Still here if you want it','', 'failed', '2026-03-26 11:40:33.29511+00'::timestamptz),
    (v_lead_id, v_partner_id, 5, 'warm', 'Leaving this with you',    '', 'failed', '2026-03-26 11:41:17.826729+00'::timestamptz),

    -- Successful sequence (touches 1-5 with real bodies)
    (v_lead_id, v_partner_id, 1, 'warm', 'Quick question', E'Hey Chris,\n\nSaw you come through on the site. Appreciate you taking a look.\n\nQuick question before anything else: when you say you want to win big, what does that actually look like for you? More income on top of the job, or are you thinking bigger than that?\n\nJust want to make sure what I share next is actually relevant to where you''re headed.\n\n- Admin', 'sent', '2026-03-26 12:32:11.155573+00'::timestamptz),

    (v_lead_id, v_partner_id, 2, 'warm', 'Something worth seeing', E'Hey Chris,\n\nYou opened the first email, so something caught your attention. That tells me enough.\n\nYou said you want to win big. I respect that. Most people say it and mean something small. I don''t think you do.\n\nHere''s what I''ll tell you. The people I''ve seen move fast with this are the ones who already know how to show up when it counts. That''s not a dig at anyone else. It''s just true. Discipline transfers.\n\nOne guy I know was working shifts like yours when he started. He wasn''t looking for a side project. He was looking for a way out that didn''t require gambling his family''s stability on something unproven.\n\nWhat he found here held up.\n\nTake a look when you get a minute. Evenings work fine.\n\nbuildfromanywhere.com/admin\n\nLet me know what you think.\n\n- Admin', 'sent', '2026-03-26 12:32:59.564035+00'::timestamptz),

    (v_lead_id, v_partner_id, 3, 'warm', 'Honest answer', E'Hey Chris,\n\nYou have opened these twice and not replied. That tells me something. You are either not sure this is real, or you are wondering if it actually pays what it says.\n\nBoth are fair.\n\nHere is the honest answer. This is not a get-rich-quick thing. It rewards people who move fast at the start and stay consistent after that. The Fast Start structure front-loads the income on purpose. Most people who go all in early see real money in the first 90 days.\n\nYou said you want to win big. That is exactly the kind of person this is built for. But it is not for everyone, and I am not going to pretend otherwise.\n\nIf you want the full picture before deciding anything, let''s get on a quick call one evening this week. You pick the time.\n\nbuildfromanywhere.com/admin\n\n- Admin', 'sent', '2026-03-26 12:33:44.253614+00'::timestamptz),

    (v_lead_id, v_partner_id, 4, 'warm', 'Still here if you want it', E'Hey Chris,\n\nThree opens and no reply. That tells me you''re thinking about it, not dismissing it.\n\nThat''s fair. You deal with enough noise on the job. You don''t need more of it here.\n\nSo I''ll be straight. This isn''t for everyone. Some people look, decide it''s not the right time, and move on. No hard feelings either way.\n\nBut if winning big is still in the back of your head, the door is open.\n\nbuildfromanywhere.com/admin\n\n- Admin', 'sent', '2026-03-26 12:34:26.761944+00'::timestamptz),

    (v_lead_id, v_partner_id, 5, 'warm', 'Leaving this with you', E'Hey Chris,\n\nLast one from me for a while. You opened a few of these, so I figure you have your reasons for not responding. That''s fair.\n\nIf the timing is off or something else is in the way, no problem. The door stays open.\n\nIf you ever want to take a real look at what I put together, it''s still there.\n\nbuildfromanywhere.com/admin\n\nTake care out there.\n\n- Admin', 'sent', '2026-03-26 12:35:11.146536+00'::timestamptz)
  ) AS new_rows (lead_id, partner_id, touch_number, lead_type, subject, body, status, sent_at)
  WHERE NOT EXISTS (
    SELECT 1 FROM bot_emails be
    WHERE be.lead_id      = new_rows.lead_id
      AND be.touch_number = new_rows.touch_number
      AND be.sent_at      = new_rows.sent_at
  );

  RAISE NOTICE 'Bot emails imported (skipped pre-existing rows).';
END $$;

-- ─── Verification: confirm what landed ──────────────────────────────────────
SELECT 'partners'   AS table_name, COUNT(*) AS rows FROM partners WHERE email = 'admin@example.com'
UNION ALL
SELECT 'leads',      COUNT(*) FROM leads      WHERE email = 'chris@gee4inc.com'
UNION ALL
SELECT 'bot_emails', COUNT(*) FROM bot_emails be
  JOIN leads l ON be.lead_id = l.id
  WHERE l.email = 'chris@gee4inc.com';
