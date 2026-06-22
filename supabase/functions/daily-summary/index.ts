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

    const today = appToday()

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

    // Hent de ansvarlige for de forfalte plantene.
    const plantIds = due.map((p) => p.id)
    const { data: respRows } = await admin
      .from('plant_responsibles')
      .select('plant_id, user_id')
      .in('plant_id', plantIds)
    const responsibleByPlant = new Map<string, string[]>()
    for (const r of (respRows ?? []) as { plant_id: string; user_id: string }[]) {
      const list = responsibleByPlant.get(r.plant_id) ?? []
      list.push(r.user_id)
      responsibleByPlant.set(r.plant_id, list)
    }

    // Husstandsmedlemmer brukes som fallback når en plante ikke har noen
    // ansvarlig satt, så den ikke blir glemt.
    const householdIds = [...new Set(due.map((p) => p.household_id))]
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, household_id')
      .in('household_id', householdIds)
    const membersByHousehold = new Map<string, string[]>()
    for (const m of (profiles ?? []) as { id: string; household_id: string }[]) {
      const list = membersByHousehold.get(m.household_id) ?? []
      list.push(m.id)
      membersByHousehold.set(m.household_id, list)
    }

    // Knytt hver plante til mottakerne sine: de ansvarlige, eller hele
    // husstanden hvis ingen er satt.
    const plantsByUser = new Map<string, DuePlant[]>()
    for (const p of due) {
      const responsibles = responsibleByPlant.get(p.id)
      const recipients =
        responsibles && responsibles.length > 0
          ? responsibles
          : (membersByHousehold.get(p.household_id) ?? [])
      for (const userId of recipients) {
        const list = plantsByUser.get(userId) ?? []
        list.push(p)
        plantsByUser.set(userId, list)
      }
    }

    // Send én e-post per mottaker med kun deres egne planter. Hver utsending er
    // isolert: feiler én (f.eks. Resend-hikke), fortsetter resten, og feilen
    // logges i stedet for å velte hele kjøringen.
    const emailById = await loadEmails(admin)
    let sent = 0
    let failed = 0
    for (const [userId, userPlants] of plantsByUser) {
      const email = emailById.get(userId)
      if (!email) continue
      const html = buildEmailHtml(userPlants, today)
      try {
        await sendEmail([email], `Planto – ${userPlants.length} plante(r) trenger vann`, html)
        sent += 1
      } catch (err) {
        failed += 1
        await logError(admin, 'daily-summary', `Utsending feilet for ${userId}`, err)
      }
    }

    return json({ ok: true, sent, failed })
  } catch (err) {
    console.error(err)
    await logError(null, 'daily-summary', 'kjøring feilet', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

/** Beste forsøk på å logge en feil til error_logs (uten å kaste selv). */
async function logError(
  admin: ReturnType<typeof createClient> | null,
  source: string,
  context: string,
  err: unknown,
): Promise<void> {
  try {
    const client =
      admin ??
      createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
    await client.from('error_logs').insert({
      source,
      context,
      message: err instanceof Error ? err.message : String(err),
      detail: err instanceof Error ? (err.stack ?? '').slice(0, 4000) : null,
    })
  } catch {
    // ignorer
  }
}

/**
 * Dagens dato (YYYY-MM-DD) i appens tidssone – ikke UTC. Dette holder e-postens
 * «forfaller i dag / på etterskudd» i takt med klienten, som regner i lokal tid.
 * Uten dette ville en cron-kjøring på kvelden (norsk tid) brukt morgendagens
 * UTC-dato og tatt med planter en dag for tidlig. Tidssonen kan overstyres med
 * APP_TIMEZONE (IANA-navn), standard Europe/Oslo.
 */
function appToday(): string {
  const tz = Deno.env.get('APP_TIMEZONE') ?? 'Europe/Oslo'
  // 'en-CA' gir ISO-formatet YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

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

  const list = (arr: DuePlant[]) =>
    `<ul style="margin:0;padding-left:18px;color:#374151">
       ${arr
         .map(
           (p) =>
             `<li>${escapeHtml(p.nickname)}${p.location ? ` <span style="color:#9ca3af">(${escapeHtml(p.location)})</span>` : ''}</li>`,
         )
         .join('')}
     </ul>`

  const heading = (title: string) =>
    `<h3 style="margin:16px 0 8px;color:#166534">${title}</h3>`

  // Vis kategori-overskrifter bare når begge gruppene finnes – ellers blir de
  // bare en redundant gjentakelse av introteksten.
  const body =
    overdue.length > 0 && dueToday.length > 0
      ? heading('På etterskudd') + list(overdue) + heading('Forfaller i dag') + list(dueToday)
      : list([...overdue, ...dueToday])

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
    <p style="color:#374151">Disse plantene trenger vann:</p>
    ${body}
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
