// ═══════════════════════════════════════════════════════════════
//  PM SCANNER — GitHub Actions Background Scanner
//  3-tier alert system:
//    Ogni 4h  → solo CRITICI (score 20+)
//    Ogni 8h  (08:00, 16:00, 00:00 Italia) → CRITICI + ALLERTA
//    Ogni 24h (08:00 Italia) → REPORT COMPLETO + EMAIL
// ═══════════════════════════════════════════════════════════════

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MANUAL_LEVEL = process.env.MANUAL_LEVEL || "";

const RESEND_KEY = process.env.RESEND_KEY || "";
const EMAIL_TO = process.env.EMAIL_TO || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "PM Scanner <onboarding@resend.dev>";

function getAlertTier() {
  if (MANUAL_LEVEL) return MANUAL_LEVEL;
  const now = new Date();
  const italyHour = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Rome" })).getHours();
  if (italyHour === 8) return "all";
  if (italyHour === 16 || italyHour === 0) return "alert";
  return "critical";
}

const fmt = (n) => { if (!n && n !== 0) return "$0"; if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`; return `$${Math.round(n)}`; };
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const ago = (h) => { if (h < 1) return `${Math.round(h*60)}m`; if (h < 24) return `${Math.round(h)}h`; if (h < 168) return `${(h/24).toFixed(1)}d`; return `${(h/168).toFixed(1)}w`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TIER_LABELS = { critical: "🔴 SOLO CRITICI (ogni 4h)", alert: "🔴🟠 CRITICI + ALLERTA (ogni 8h)", all: "📊 REPORT COMPLETO (giornaliero)" };

async function safeFetch(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try { const r = await fetch(url); if (r.ok) return r; if (r.status === 429) { await sleep(2000 * (i + 1)); continue; } } catch (e) { if (i < retries - 1) await sleep(1000 * (i + 1)); }
  }
  return null;
}

const SPORT_RE = /nba|nfl|nhl|mlb|nascar|mma|ufc|epl|serie.a|bundesliga|ligue|premier.league|champions.league|ncaa|tennis|golf|cricket|wnba|mls|la.liga|football|basketball|baseball|hockey|soccer|boxing/i;
const GEO_RE = /politic|geopolit|military|war|conflict|government|election|diplomacy|sanction|regime/i;
const CFG = { rareCategoryMax:3, newTypeMaxAge:72, newTypeMinVol:5000, surgeMinVol:3000, surgeRatio:0.2, surgeVsMedian:5, priceSwingMin:0.1, volLiqImbalance:4, bookSkewThreshold:0.75, nicheMaxTotalVol:50000, nicheMinDailyVol:2000, nicheHeatRatio:0.15, geoExpiryHours:72, spreadWide:0.06 };

function analyze(markets, priceHistories) {
  const sigs = [];
  const v24s = markets.map(m => parseFloat(m.volume24hr)||0).filter(v => v > 0);
  const medV = v24s.sort((a,b) => a-b)[Math.floor(v24s.length/2)] || 1000;
  const tc = {};
  for (const m of markets) for (const t of m.tags||[]) { const l = t.label||t.slug||t; tc[l] = (tc[l]||0)+1; }

  for (const m of markets) {
    const vol = parseFloat(m.volume)||0, v24 = parseFloat(m.volume24hr)||0, liq = parseFloat(m.liquidity)||0;
    const prices = JSON.parse(m.outcomePrices||"[]").map(Number), yP = prices[0]||0;
    const aH = (Date.now() - new Date(m.createdAt)) / 36e5;
    const tags = (m.tags||[]).map(t => t.label||t.slug||"");
    const sp = m._spread||0, bi = m._bookImbalance||0, prH = priceHistories[m.id]||null, q = (m.question||"").toLowerCase();
    if (tags.some(t => SPORT_RE.test(t)) || SPORT_RE.test(q)) continue;

    const det = [];
    const rare = tags.some(t => (tc[t]||0) <= CFG.rareCategoryMax);
    if (rare && aH < CFG.newTypeMaxAge) det.push({signal:"NEW_TYPE",icon:"🆕",label:"Nuova tipologia",weight:v24>CFG.newTypeMinVol?4:2,severity:v24>CFG.newTypeMinVol?"critical":"watch",detail:`Cat. rara — creato ${ago(aH)} fa`});

    const vR = vol>0?v24/vol:0, vM = v24/Math.max(medV,1), isConc = aH<72&&vR>0.5;
    if (v24>CFG.surgeMinVol&&(vR>CFG.surgeRatio||vM>CFG.surgeVsMedian)) { const big=vR>CFG.surgeRatio*2||vM>CFG.surgeVsMedian*3; const w=Math.min((big?5:3)+(isConc?2:0),7); det.push({signal:"VOLUME_SURGE",icon:"📊",label:"Picco volume"+(isConc?" ⚡":""),weight:w,severity:big||isConc?"critical":"alert",detail:`24h ${fmt(v24)} = ${(vR*100).toFixed(0)}% tot, ${vM.toFixed(1)}x med`}); }

    if (prH&&prH.length>=3) { const r=prH.slice(-6); const sw=Math.abs((r[r.length-1]?.p||yP)-(r[0]?.p||yP)); if(sw>CFG.priceSwingMin) det.push({signal:"PRICE_DISLOCATION",icon:"⚡",label:"Prezzo dislocato",weight:sw>CFG.priceSwingMin*2?5:3,severity:sw>CFG.priceSwingMin*2?"critical":"alert",detail:`Swing ${pct(sw)}`}); }

    if (v24>CFG.surgeMinVol&&liq>0&&v24/liq>CFG.volLiqImbalance) det.push({signal:"LIQ_IMBALANCE",icon:"💧",label:"Squil. Vol/Liq",weight:v24/liq>CFG.volLiqImbalance*2?4:2,severity:v24/liq>CFG.volLiqImbalance*2?"critical":"alert",detail:`${fmt(v24)} su ${fmt(liq)} liq`});

    const isUnc = yP>0.2&&yP<0.8;
    if (Math.abs(bi)>CFG.bookSkewThreshold&&isUnc) det.push({signal:"BOOK_SKEW",icon:"📐",label:"Book sbilanciato",weight:Math.abs(bi)>CFG.bookSkewThreshold*1.5?3:1,severity:Math.abs(bi)>CFG.bookSkewThreshold*1.5?"alert":"watch",detail:`${pct(Math.abs(bi))} → ${bi>0?"BID":"ASK"}`});

    if (vol<CFG.nicheMaxTotalVol&&v24>CFG.nicheMinDailyVol&&v24/Math.max(vol,1)>CFG.nicheHeatRatio) det.push({signal:"NICHE_HEAT",icon:"🔍",label:"Nicchia attiva",weight:3,severity:"alert",detail:`${fmt(vol)} tot ma ${fmt(v24)} oggi`});

    const eD=m.endDate?new Date(m.endDate):null, hE=eD?(eD-Date.now())/36e5:Infinity;
    if (tags.some(t=>GEO_RE.test(t))&&hE<CFG.geoExpiryHours&&v24>CFG.surgeMinVol) det.push({signal:"GEO_SENSITIVE",icon:"🌐",label:"Geo sensibile",weight:4,severity:"critical",detail:`Scad. ${ago(hE)}, vol ${fmt(v24)}`});

    if (sp>CFG.spreadWide&&v24>CFG.surgeMinVol) det.push({signal:"INFORMED_FLOW",icon:"🎯",label:"Flusso informato",weight:3,severity:"alert",detail:`Spread ${pct(sp)}, vol ${fmt(v24)}`});

    if (det.length>0) {
      let tw=det.reduce((s,d)=>s+d.weight,0); const nS=det.length;
      if(nS>=5)tw=Math.round(tw*1.5); else if(nS>=4)tw=Math.round(tw*1.2); else if(nS<=2)tw=Math.round(tw*0.6);
      const hasGold=det.some(d=>d.signal==="NEW_TYPE"||d.signal==="INFORMED_FLOW"||d.signal==="LIQ_IMBALANCE");
      const hasCon=det.some(d=>d.detail?.includes("⚡"));
      const conf=nS>=5&&hasGold?"ALTA":nS>=3&&(hasGold||hasCon)?"MEDIA":"BASSA";
      const ms=det.some(d=>d.severity==="critical")?"critical":det.some(d=>d.severity==="alert")?"alert":"watch";
      sigs.push({market:m,detections:det,totalWeight:tw,maxSeverity:ms,confidence:conf,vol24h:v24,yesPrice:yP,ageH:aH});
    }
  }
  return sigs.sort((a,b)=>b.totalWeight-a.totalWeight);
}

function filterByTier(signals, tier) {
  if (tier==="all") return signals.filter(s=>s.totalWeight>=5);
  if (tier==="alert") return signals.filter(s=>s.maxSeverity==="critical"||s.maxSeverity==="alert");
  return signals.filter(s=>s.maxSeverity==="critical"&&s.totalWeight>=15);
}

async function sendTelegram(text) {
  if (!BOT_TOKEN||!CHAT_ID) { console.log("⚠ Telegram non configurato."); return false; }
  try {
    const chunks=[]; let rem=text;
    while(rem.length>0){let cut=rem.substring(0,4000);if(rem.length>4000){const nl=cut.lastIndexOf("\n\n");if(nl>2000)cut=rem.substring(0,nl)}chunks.push(cut);rem=rem.substring(cut.length)}
    for(const chunk of chunks){
      const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:CHAT_ID,text:chunk,parse_mode:"HTML",disable_web_page_preview:true})});
      const d=await r.json(); if(!d.ok)console.log("TG error:",d.description); await sleep(300);
    }
    return true;
  } catch(e){ console.log("TG failed:",e.message); return false; }
}

async function sendEmail(subject, htmlBody) {
  if (!RESEND_KEY||!EMAIL_TO){ console.log("⚠ Email non configurata."); return false; }
  try {
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${RESEND_KEY}`},body:JSON.stringify({from:EMAIL_FROM,to:[EMAIL_TO],subject,html:htmlBody})});
    const d=await r.json();
    if(d.id){console.log("✅ Email inviata:",d.id);return true}
    console.log("Email error:",JSON.stringify(d)); return false;
  } catch(e){ console.log("Email failed:",e.message); return false; }
}

function buildEmailHTML(signals,tier,stats,elapsed) {
  const now=new Date().toLocaleString("it-IT",{timeZone:"Europe/Rome"});
  const crits=signals.filter(s=>s.maxSeverity==="critical"), alrts=signals.filter(s=>s.maxSeverity==="alert"), watches=signals.filter(s=>s.maxSeverity==="watch");
  let html=`<div style="font-family:-apple-system,sans-serif;max-width:650px;margin:0 auto;background:#0a0a0f;color:#e5e5ee;padding:24px;border-radius:12px;">
  <h1 style="color:#ff2d55;font-size:22px;margin:0 0 4px;">🔍 PM INSIDER SCANNER</h1>
  <p style="color:#707088;font-size:14px;margin:0 0 20px;">${now} — ${TIER_LABELS[tier]}</p>
  <table style="width:100%;margin-bottom:20px;"><tr>
    <td style="background:#111118;padding:12px;border-radius:8px;border:1px solid #1e1e2e;text-align:center;"><div style="color:#707088;font-size:11px;">SCANSIONATI</div><div style="color:#e5e5ee;font-size:20px;font-weight:700;">${stats.scanned}</div></td>
    <td style="background:#111118;padding:12px;border-radius:8px;border:1px solid #ff2d5540;text-align:center;"><div style="color:#ff2d55;font-size:11px;">CRITICI</div><div style="color:#ff2d55;font-size:20px;font-weight:700;">${crits.length}</div></td>
    <td style="background:#111118;padding:12px;border-radius:8px;border:1px solid #ff9f0a40;text-align:center;"><div style="color:#ff9f0a;font-size:11px;">ALLERTA</div><div style="color:#ff9f0a;font-size:20px;font-weight:700;">${alrts.length}</div></td>
    <td style="background:#111118;padding:12px;border-radius:8px;border:1px solid #64d2ff40;text-align:center;"><div style="color:#64d2ff;font-size:11px;">MONITOR</div><div style="color:#64d2ff;font-size:20px;font-weight:700;">${watches.length}</div></td>
  </tr></table>`;
  for(const s of signals.slice(0,15)){
    const sc=s.maxSeverity==="critical"?"#ff2d55":s.maxSeverity==="alert"?"#ff9f0a":"#64d2ff";
    const cb=s.confidence==="ALTA"?"⭐ ALTA":s.confidence==="MEDIA"?"◉ MEDIA":"○ BASSA";
    html+=`<div style="background:#111118;border:1px solid ${sc}30;border-left:4px solid ${sc};border-radius:8px;padding:16px;margin-bottom:12px;">
    <div style="margin-bottom:8px;"><strong style="font-size:15px;">${s.market.question}</strong> <span style="background:${sc}20;color:${sc};padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;">Score ${s.totalWeight}</span></div>
    <div style="color:#707088;font-size:13px;margin-bottom:8px;">${fmt(s.vol24h)} vol · ${pct(s.yesPrice)} YES · ${ago(s.ageH)} · ${cb}</div>`;
    for(const d of s.detections) html+=`<div style="color:#b0b0c0;font-size:13px;padding:2px 0;">${d.icon} <strong>${d.label}</strong>: ${d.detail}</div>`;
    html+=`<a href="https://polymarket.com/event/${s.market.slug}" style="display:inline-block;margin-top:8px;color:#64d2ff;font-size:13px;">→ Apri su Polymarket</a></div>`;
  }
  if(signals.length>15) html+=`<p style="color:#707088;font-style:italic;text-align:center;">...e altri ${signals.length-15} segnali</p>`;
  html+=`<p style="color:#404058;font-size:12px;text-align:center;margin-top:20px;">Scansione in ${elapsed}s · PM Scanner</p></div>`;
  return html;
}

function buildTelegramMsg(signals,tier,stats,elapsed) {
  const now=new Date().toLocaleString("it-IT",{timeZone:"Europe/Rome"});
  const crits=signals.filter(s=>s.maxSeverity==="critical"), alrts=signals.filter(s=>s.maxSeverity==="alert");
  let msg=`<b>🔍 PM INSIDER SCANNER</b>\n📅 ${now}\n${TIER_LABELS[tier]}\n━━━━━━━━━━━━━━━━━━━━\n📊 ${stats.scanned} mercati | 🔴 ${crits.length} critici | 🟠 ${alrts.length} allerta\n━━━━━━━━━━━━━━━━━━━━\n\n`;
  if(!signals.length) msg+=`✅ Nessun segnale per questo livello.\n`;
  const mx=tier==="all"?12:tier==="alert"?8:5;
  for(const s of signals.slice(0,mx)){
    const si=s.maxSeverity==="critical"?"🔴":s.maxSeverity==="alert"?"🟠":"🔵";
    const ci=s.confidence==="ALTA"?"⭐":s.confidence==="MEDIA"?"◉":"○";
    msg+=`${si}${ci} <b>${s.market.question}</b>\nScore: ${s.totalWeight} | ${fmt(s.vol24h)} vol | ${pct(s.yesPrice)} YES | ${ago(s.ageH)}\n`;
    for(const d of s.detections) msg+=`  ${d.icon} ${d.label}: ${d.detail}\n`;
    msg+=`<a href="https://polymarket.com/event/${s.market.slug}">→ Polymarket</a>\n\n`;
  }
  if(signals.length>mx) msg+=`<i>...e altri ${signals.length-mx} segnali</i>\n`;
  msg+=`\n⏱ ${elapsed}s`;
  return msg;
}

async function main() {
  const startTime=Date.now();
  const tier=getAlertTier();
  console.log("═══════════════════════════════════════════");
  console.log("  PM SCANNER — Background Scan");
  console.log(`  ${new Date().toISOString()}`);
  console.log(`  Tier: ${TIER_LABELS[tier]}`);
  console.log("═══════════════════════════════════════════\n");

  console.log("📡 Fetching markets...");
  let allMarkets=[];
  for(let i=0;i<6;i++){const r=await safeFetch(`${GAMMA}/markets?closed=false&active=true&limit=100&offset=${i*100}&order=volume24hr&ascending=false`);if(!r)break;const d=await r.json();if(!d.length)break;allMarkets=allMarkets.concat(d);await sleep(300)}
  console.log(`  ✓ ${allMarkets.length} mercati caricati\n`);
  if(!allMarkets.length){await sendTelegram("⚠️ <b>PM Scanner</b>: scansione fallita.");process.exit(1)}

  console.log("📊 Analisi orderbook...");
  const top=allMarkets.filter(m=>(parseFloat(m.volume24hr)||0)>0).sort((a,b)=>(parseFloat(b.volume24hr)||0)-(parseFloat(a.volume24hr)||0)).slice(0,60);
  for(let i=0;i<top.length;i+=3){const batch=top.slice(i,i+3);await Promise.all(batch.map(async m=>{try{const tk=JSON.parse(m.clobTokenIds||"[]");if(!tk[0])return;const bR=await safeFetch(`${CLOB}/book?token_id=${tk[0]}`);if(!bR)return;const bk=await bR.json();const bV=(bk.bids||[]).reduce((s,b)=>s+parseFloat(b.size||0),0);const aV=(bk.asks||[]).reduce((s,a)=>s+parseFloat(a.size||0),0);const t=bV+aV;m._bookImbalance=t>0?(bV-aV)/t:0;const bb=bk.bids?.[0]?.price?parseFloat(bk.bids[0].price):0;const ba=bk.asks?.[0]?.price?parseFloat(bk.asks[0].price):1;m._spread=ba-bb}catch{}}));await sleep(250)}
  console.log(`  ✓ ${top.length} orderbook\n`);

  console.log("📈 Storico prezzi...");
  const prH={};const cands=top.slice(0,30);
  for(let i=0;i<cands.length;i+=3){const batch=cands.slice(i,i+3);await Promise.all(batch.map(async m=>{try{const tk=JSON.parse(m.clobTokenIds||"[]");if(!tk[0])return;const r=await safeFetch(`${CLOB}/prices-history?market=${tk[0]}&interval=1d&fidelity=60`);if(!r)return;const d=await r.json();if(d.history?.length)prH[m.id]=d.history.map(h=>({t:h.t,p:parseFloat(h.p)}))}catch{}}));await sleep(250)}
  console.log(`  ✓ ${Object.keys(prH).length} storici\n`);

  console.log("🔍 Analisi segnali...");
  const allSignals=analyze(allMarkets,prH);
  const filtered=filterByTier(allSignals,tier);
  const stats={scanned:allMarkets.length,signals:allSignals.length,critical:allSignals.filter(s=>s.maxSeverity==="critical").length,alert:allSignals.filter(s=>s.maxSeverity==="alert").length,watch:allSignals.filter(s=>s.maxSeverity==="watch").length};
  console.log(`  ✓ ${allSignals.length} totali → ${filtered.length} per tier "${tier}"\n`);

  const elapsed=((Date.now()-startTime)/1000).toFixed(1);

  // TELEGRAM
  if(filtered.length>0){
    const msg=buildTelegramMsg(filtered,tier,stats,elapsed);
    const ok=await sendTelegram(msg);console.log(ok?"✅ Telegram inviato!":"❌ Telegram fallito");
  } else {
    console.log(`✅ Nessun segnale tier "${tier}"`);
    if(tier==="all") await sendTelegram(`✅ <b>PM Scanner — Report giornaliero</b>\n📅 ${new Date().toLocaleString("it-IT",{timeZone:"Europe/Rome"})}\n\n${stats.scanned} mercati — nessuna anomalia.\n⏱ ${elapsed}s`);
  }

  // EMAIL — daily report OR urgent criticals
  if(tier==="all"&&RESEND_KEY&&EMAIL_TO){
    const subj=filtered.length>0?`🔍 PM Scanner: ${stats.critical} critici, ${stats.alert} allerta`:`✅ PM Scanner: nessuna anomalia`;
    const all5=allSignals.filter(s=>s.totalWeight>=5);
    await sendEmail(subj,buildEmailHTML(all5,tier,stats,elapsed));
  }
  if(tier!=="all"&&RESEND_KEY&&EMAIL_TO){
    const urgent=filtered.filter(s=>s.maxSeverity==="critical"&&s.totalWeight>=20);
    if(urgent.length>0) await sendEmail(`🚨 PM Scanner URGENTE: ${urgent.length} critici!`,buildEmailHTML(urgent,"critical",stats,elapsed));
  }

  console.log(`\n⏱ Completato in ${elapsed}s`);
}

main().catch(e=>{console.error("Fatal:",e);process.exit(1)});
