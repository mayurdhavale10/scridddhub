// Auto-fill for Bhulekh (bhulekh.mahabhumi.gov.in) inside the in-app browser. The site is
// ASP.NET WebForms: each dropdown change posts back, sometimes as a full reload and sometimes as a
// partial update with no page load at all. So the script installs a small loop that checks once a
// second and does the NEXT step it can: district → taluka → village → survey number search →
// survey (with hissa) → mobile. It then stops at the captcha, which the PERSON types and submits.
// When the 7/12 is on screen it posts the page text to the app. The app re-injects the script
// after every full load. It never touches the captcha (owner decision 2026-10-10).
//
// Element ids were read from the live page on 2026-10-11 (ContentPlaceHolder1_*). If Bhulekh
// changes its form, the script reports which step it couldn't do and the person does it by hand.

export type BhulekhPlan = {
  id: string; // changes per lookup, so step counters reset
  district: string; // Marathi, as in the site's dropdown (e.g. ठाणे)
  taluka: string;
  village: string;
  surveyPart1: string; // digits before the first slash, e.g. "45"
  survey: string; // full survey/gat number with hissa, e.g. "45/2A"
  mobile: string;
};

// Messages the script posts to the app.
export type BhulekhMessage =
  | { stage: 'captcha' } // everything filled; waiting for the person
  | { stage: 'choose'; field: string } // couldn't match a value; the person picks it
  | { stage: 'result'; url: string; text: string; image?: string; mime?: string } // the 7/12 is on screen (image: base64, when it's a picture)
  | { stage: 'options'; options: string[] } // a bare survey number has these hissas
  | { stage: 'busy'; step: string };

/** The digits before the first slash: "45/2A" → "45". */
export function surveyPart1(survey: string): string {
  const digits = survey.replace(/[०-९]/g, d => String('०१२३४५६७८९'.indexOf(d)));
  const m = digits.match(/\d+/);
  return m ? m[0] : '';
}

export function buildFillScript(plan: BhulekhPlan): string {
  return `(function () {
  var plan = ${JSON.stringify(plan)};
  if (window.__shFill && window.__shFill.id === plan.id) return; // already running on this page
  var state = window.__shFill = { id: plan.id, lastAction: 0, done: false, lastPost: '' };

  function post(m) {
    var s = JSON.stringify(m);
    if (s === state.lastPost && m.stage !== 'result') return; // don't repeat the same status
    state.lastPost = s;
    window.ReactNativeWebView.postMessage(s);
  }
  function $(id) { return document.getElementById('ContentPlaceHolder1_' + id); }
  function norm(s) {
    return (s || '').replace(/[\\u200b-\\u200d\\s.\\-]/g, '').replace(/[०-९]/g, function (d) { return '०१२३४५६७८९'.indexOf(d); }).toLowerCase();
  }
  // The main survey number of an option: "1/1/अ" → "1", "105/2" → "105". Compared whole, so
  // survey 1 never matches 10, 105 or 1000.
  function mainNumber(s) {
    var m = norm(s).match(/^\\d+/);
    return m ? m[0] : '';
  }
  function survNorm(s) {
    s = norm(s).toUpperCase();
    var map = { 'अ': 'A', 'ब': 'B', 'क': 'C', 'ड': 'D', 'इ': 'E' };
    return s.replace(/[अबकडइ]/g, function (c) { return map[c]; }).replace(/[^0-9A-Z]/g, '');
  }
  // Steps tried per lookup (kept across reloads), so a field that never matches can't loop.
  var key = 'sh_' + plan.id;
  function attempt(step) {
    var tries = JSON.parse(sessionStorage.getItem(key) || '{}');
    tries[step] = (tries[step] || 0) + 1;
    sessionStorage.setItem(key, JSON.stringify(tries));
    return tries[step] <= 3;
  }
  function act(step, fn) { post({ stage: 'busy', step: step }); state.lastAction = Date.now(); fn(); }

  function readResult() {
    // Bhulekh shows the 7/12 as a JPEG in the page (ImgPC), with no text to read (seen 2026-10-11).
    var img = $('ImgPC');
    if (img && img.src && img.src.indexOf('data:image/') === 0 && img.naturalWidth > 400 && img.offsetParent !== null) {
      var m = img.src.match(/^data:(image\\/[a-z]+);base64,(.*)$/);
      if (m) {
        state.done = true;
        post({ stage: 'result', url: location.href, text: '', mime: m[1], image: m[2] });
        return true;
      }
    }
    var t = document.body ? document.body.innerText : '';
    if (t.indexOf('भोगवटादार') >= 0 || t.indexOf('भूमापन क्रमांक') >= 0 || t.indexOf('Occupant') >= 0) {
      state.done = true;
      post({ stage: 'result', url: location.href, text: t });
      return true;
    }
    return false;
  }

  // One step: returns true when this field is already right, false when it acted or must wait.
  function pick(id, wanted, step) {
    var sel = $(id);
    if (!sel) { post({ stage: 'choose', field: step }); return false; }
    var w = norm(wanted), best = null, any = false;
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i], t = norm(o.text);
      if (!o.value || o.value === '0' || o.value === '-1') continue;
      any = true;
      if (t === w) { best = o; break; }
      if (!best && (t.indexOf(w) >= 0 || w.indexOf(t) >= 0)) best = o;
    }
    if (!any) return false; // list not loaded yet: wait
    if (!best) { post({ stage: 'choose', field: step }); return false; }
    if (sel.value === best.value) return true;
    if (!attempt(step)) { post({ stage: 'choose', field: step }); return false; }
    act(step, function () { sel.value = best.value; sel.dispatchEvent(new Event('change', { bubbles: true })); });
    return false;
  }

  function tick() {
    if (state.done || readResult()) return;
    if (Date.now() - state.lastAction < 2500) return; // let the last postback finish
    if (!$('ddlMainDist')) return; // not the search form (e.g. a result page still loading)

    if (!pick('ddlMainDist', plan.district, 'district')) return;
    if (!pick('ddlTalForAll', plan.taluka, 'taluka')) return;
    if (!pick('ddlVillForAll', plan.village, 'village')) return;

    var surveys = $('ddlsurveyno'), csno = $('txtcsno'), find = $('btnsearchfind');
    var listed = surveys && Array.prototype.some.call(surveys.options, function (o) {
      return o.value && o.value !== '0' && mainNumber(o.text) === plan.surveyPart1;
    });
    if (!listed) {
      if (!csno || !find) { post({ stage: 'choose', field: 'survey' }); return; }
      if (!attempt('search')) { post({ stage: 'choose', field: 'survey' }); return; }
      act('search', function () { csno.value = plan.surveyPart1; find.click(); });
      return;
    }
    var want = survNorm(plan.survey), match = null, candidates = [];
    for (var i = 0; i < surveys.options.length; i++) {
      var o = surveys.options[i];
      if (!o.value || o.value === '0' || mainNumber(o.text) !== plan.surveyPart1) continue;
      candidates.push(o);
      if (survNorm(o.text) === want) match = o;
    }
    if (!match && candidates.length === 1) match = candidates[0];
    // A bare number ("1") with several hissas listed: hand the list back so the app can queue each
    // hissa as its own lookup.
    if (!match && candidates.length > 1 && !/[\\/]/.test(plan.survey)) {
      post({ stage: 'options', options: candidates.map(function (o) { return o.text.trim(); }) });
      state.done = true;
      return;
    }
    if (!match) { post({ stage: 'choose', field: 'survey' }); return; }
    if (surveys.value !== match.value) {
      if (!attempt('survey')) { post({ stage: 'choose', field: 'survey' }); return; }
      act('survey', function () { surveys.value = match.value; surveys.dispatchEvent(new Event('change', { bubbles: true })); });
      return;
    }

    var mob = $('txtmobile1');
    if (mob && plan.mobile && mob.value !== plan.mobile) { mob.value = plan.mobile; }
    var cap = $('txtcaptcha');
    if (cap && state.lastPost.indexOf('captcha') < 0) { cap.scrollIntoView({ block: 'center' }); cap.focus(); }
    post({ stage: 'captcha' });
  }

  tick();
  setInterval(tick, 1000);
})(); true;`;
}
