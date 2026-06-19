// Edge Function: daily-summary
// Planlagt jobb (SPEC M4): finner planter som forfaller i dag eller er på
// etterskudd, og sender en daglig e-postoppsummering til hver husstands
// medlemmer via Resend.
//
// Kalles av en cron-jobb (se supabase/scheduled.sql). Beskyttet med CRON_SECRET.

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface DuePlant {
  id: string
  nickname: string
  location: string | null
  household_id: string
  next_water_due: string
}

Deno.serve(async (req) => {
  // Beskyttelse: krev riktig hemmelig header hvis CRON_SECRET er satt.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const today = new Date().toISOString().slice(0, 10)

    const { data: plants, error } = await admin
      .from('plants')
      .select('id, nickname, location, household_id, next_water_due')
      .not('next_water_due', 'is', null)
      .lte('next_water_due', today)
      .order('next_water_due', { ascending: true })
    if (error) throw error

    const due = (plants ?? []) as DuePlant[]
    if (due.length === 0) {
      return json({ ok: true, sent: 0, message: 'Ingen planter forfaller.' })
    }

    // Grupper planter per husstand.
    const byHousehold = new Map<string, DuePlant[]>()
    for (const p of due) {
      const list = byHousehold.get(p.household_id) ?? []
      list.push(p)
      byHousehold.set(p.household_id, list)
    }

    // Hent medlemmer per husstand.
    const householdIds = [...byHousehold.keys()]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, household_id, display_name')
      .in('household_id', householdIds)

    // Bygg e-post-kart (auth.users har e-posten).
    const emailById = await loadEmails(admin)

    let sent = 0
    for (const householdId of householdIds) {
      const members = (profiles ?? []).filter((m) => m.household_id === householdId)
      const plantsForHome = byHousehold.get(householdId)!
      const recipients = members
        .map((m) => emailById.get(m.id))
        .filter((e): e is string => Boolean(e))
      if (recipients.length === 0) continue

      const html = buildEmailHtml(plantsForHome, today)
      await sendEmail(recipients, `Planto – ${plantsForHome.length} plante(r) trenger vann`, html)
      sent += recipients.length
    }

    return json({ ok: true, sent })
  } catch (err) {
    console.error(err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

async function loadEmails(
  admin: ReturnType<typeof createClient>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let page = 1
  // listUsers er paginert; for to brukere holder én side, men vi looper for sikkerhets skyld.
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    for (const u of data.users) if (u.email) map.set(u.id, u.email)
    if (data.users.length < 1000) break
    page++
  }
  return map
}

function buildEmailHtml(plants: DuePlant[], today: string): string {
  const overdue = plants.filter((p) => p.next_water_due < today)
  const dueToday = plants.filter((p) => p.next_water_due === today)

  const section = (title: string, list: DuePlant[]) =>
    list.length === 0
      ? ''
      : `<h3 style="margin:16px 0 8px;color:#166534">${title}</h3>
         <ul style="margin:0;padding-left:18px;color:#374151">
           ${list
             .map(
               (p) =>
                 `<li>${escapeHtml(p.nickname)}${p.location ? ` <span style="color:#9ca3af">(${escapeHtml(p.location)})</span>` : ''}</li>`,
             )
             .join('')}
         </ul>`

  return `
  <div style="font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:8px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:4px">
      <tr>
        <td style="vertical-align:middle">
          <img src="https://planto.space/icons/icon-192.png" width="36" height="36" alt="Planto"
               style="display:block;border-radius:9px" />
        </td>
        <td style="vertical-align:middle;padding-left:10px;font-weight:700;font-size:18px;color:#166534">
          Planto
        </td>
      </tr>
    </table>
    <h2 style="color:#16a34a;margin:12px 0 4px">God morgen!</h2>
    <p style="color:#374151">Disse plantene trenger vann i dag:</p>
    ${section('På etterskudd', overdue)}
    ${section('Forfaller i dag', dueToday)}
    <p style="margin-top:20px;color:#6b7280;font-size:13px">
      Åpne Planto og trykk «Vannet i dag» når du er ferdig.
    </p>
  </div>`
}

async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM') ?? 'Planto <sprout@planto.space>'
  if (!apiKey) throw new Error('Mangler RESEND_API_KEY')

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Resend-feil (${res.status}): ${detail.slice(0, 200)}`)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
