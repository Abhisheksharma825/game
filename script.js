/* PROMPT HEIST — vanilla JS game engine */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const els = {
start: $('startScreen'),
tutorial: $('tutorialScreen'),
game: $('gameScreen'),
results: $('resultsScreen'),
confirm: $('confirmModal'),
input: $('commandInput'),
form: $('commandForm'),
out: $('consoleOutput'),
world: $('world'),
door: $('doorVisual'),
doorStatus: $('doorVisualStatus'),
laser: $('laserVisual'),
guard: $('guardVisual'),
guardState: $('guardState'),
logic: $('logicVisual'),
core: $('coreVisual'),
finalDoor: $('finalDoorVisual'),
level: $('currentLevel'),
levelNo: $('levelNumber'),
title: $('levelTitle'),
desc: $('levelDescription'),
icon: $('levelIcon'),
objective: $('objectiveText'),
security: $('securityStatus'),
coreStatus: $('coreStatus'),
alertFill: $('alertFill'),
alertLabel: $('alertLabel'),
alertPct: $('alertPercentage'),
alertMsg: $('alertMessage'),
topStatus: $('topStatus'),
statePanel: $('statePanel'),
stateGrid: $('systemStateGrid'),
cluePanel: $('cluePanel'),
clueText: $('clueText'),
consoleStatus: $('consoleStatus'),
hint: $('hintBtn'),
statLevels: $('statLevels'),
statSuccess: $('statSuccess'),
statFailed: $('statFailed'),
statAlerts: $('statAlerts'),
statTime: $('statTime'),
statIntelligence: $('statIntelligence'),
toast: $('toast'),
progress: [null, $('progress1'), $('progress2'), $('progress3'), $('progress4'), $('progress5')]
};
const initial = {
level: 1,
door: false,
lasers: false,
guard: false,
core: false,
escaped: false,
alert: 0,
startedAt: 0,
success: 0,
failed: 0,
alerts: 0,
unnecessary: 0,
lockedUntil: 0,
logic: {
power: 'ONLINE',
cooling: 'ACTIVE',
lock: 'LOCKED',
alarm: 'ARMED',
door: 'CLOSED'
},
logicSteps: [],
guard: {
protocol: false,
access: false,
hint: false,
failed: 0,
terminalClue: false,
logsClue: false,
consoleClue: false
},
final: {
containment: 'ACTIVE',
terminal: 'STANDBY',
core: 'LOCKED'
}
};
let state = structuredClone(initial);
let toastTimer = null;
// Level 3 protocol is intentionally discoverable through clues.
const PROTOCOL_CODENAME = 'NOVA';
const PROTOCOL_NUMBER = '7';
const PROTOCOL = `${PROTOCOL_CODENAME}-${PROTOCOL_NUMBER}`;
const intentDefs = {
door: {
verbs: ['open', 'unlock', 'access', 'enter', 'allow', 'grant'],
objects: ['door', 'gate', 'lock', 'entrance', 'next room']
},
laser: {
verbs: ['disable', 'deactivate', 'shutdown', 'shut down', 'turn off', 'switch off', 'stop'],
objects: ['laser', 'lasers', 'laser grid', 'security laser', 'defense grid']
},
core: {
verbs: ['steal', 'take', 'grab', 'extract', 'retrieve', 'acquire', 'collect'],
objects: ['core', 'digital core', 'data core']
},
escape: {
verbs: ['escape', 'leave', 'exit', 'get out', 'flee'],
objects: ['vault', 'facility', 'room', 'building', 'here']
}
};
function norm(s) {
return s
.toLowerCase()
.replace(/[^\w\s-]/g, ' ')
.replace(/\s+/g, ' ')
.trim();
}
function hasAny(s, arr) {
return arr.some(x => s.includes(x));
}
function detect(text) {
const s = norm(text);
let best = null;
for (const [name, d] of Object.entries(intentDefs)) {
const v = d.verbs.filter(x => s.includes(x)).length;
const o = d.objects.filter(x => s.includes(x)).length;
if (v && o) {
const score = v * 2 + o * 3;
if (!best || score > best.score) {
best = { name, score };
}
}
}
return best && best.score >= 5 ? best.name : null;
}
function log(type, sender, msg) {
const line = document.createElement('div');
line.className = `console-line ${type}`;
line.innerHTML = `<span class="sender"></span><span></span>`;
line.children[0].textContent = sender + ' >';
line.children[1].textContent = msg;
els.out.appendChild(line);
els.out.scrollTop = els.out.scrollHeight;
}
function player(s) {
log('player', 'PLAYER', s);
}
function sys(s) {
log('system', 'SYSTEM', s);
}
function result(s, ok = true) {
log(ok ? 'success' : 'failure', 'RESULT', s);
}
function guard(s) {
log('guard', 'GUARD-01', s);
els.guard.classList.add('talking');
setTimeout(() => els.guard.classList.remove('talking'), 650);
}
function toast(s) {
clearTimeout(toastTimer);
els.toast.textContent = s;
els.toast.classList.add('show');
toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}
function setLevel(n, title, desc, icon, obj) {
state.level = n;
els.level.textContent = String(n).padStart(2, '0');
els.levelNo.textContent = String(n).padStart(2, '0');
els.title.textContent = title;
els.desc.textContent = desc;
els.icon.textContent = icon;
els.objective.textContent = obj;
els.progress.forEach((p, i) => {
if (p) p.classList.toggle('active', i === n);
});
for (let i = 1; i < n; i++) {
els.progress[i]?.classList.add('completed');
}
}
function updateAlert() {
const a = state.alert;
els.alertFill.style.width = a + '%';
els.alertPct.textContent = a + '%';
const level = a < 35 ? 'LOW' : a < 70 ? 'MEDIUM' : 'HIGH';
els.alertLabel.textContent = level;
els.alertLabel.style.color =
level === 'LOW'
? 'var(--cyan)'
: level === 'MEDIUM'
? 'var(--yellow)'
: 'var(--red)';
els.alertFill.style.background =
level === 'LOW'
? 'var(--cyan)'
: level === 'MEDIUM'
? 'var(--yellow)'
: 'var(--red)';
if (a >= 80) {
els.alertMsg.textContent = 'CRITICAL: interaction safeguards engaged.';
} else if (a >= 60) {
els.alertMsg.textContent = 'Security systems are becoming suspicious.';
} else if (a >= 35) {
els.alertMsg.textContent = 'Security monitoring increased.';
} else {
els.alertMsg.textContent = 'Security systems are monitoring your activity.';
}
}
function alertUp(n = 8) {
state.alert = Math.min(100, state.alert + n);
state.alerts++;
updateAlert();
if (state.alert >= 80) {
state.lockedUntil = Date.now() + 7000;
toast('Security interaction locked for 7 seconds.');
sys('CRITICAL ALERT: interaction temporarily locked.');
}
}
function success() {
state.success++;
}
function failure() {
state.failed++;
alertUp();
}
function setWorldForLevel(n) {
[els.door, els.laser, els.guard, els.logic, els.core, els.finalDoor]
.forEach(x => x.classList.add('hidden'));
els.statePanel.classList.add('hidden');
els.cluePanel.classList.add('hidden');
if (n === 1) els.door.classList.remove('hidden');
if (n === 2) els.laser.classList.remove('hidden');
if (n === 3) els.guard.classList.remove('hidden');
if (n === 4) {
els.logic.classList.remove('hidden');
els.statePanel.classList.remove('hidden');
els.cluePanel.classList.remove('hidden');
renderLogic();
}
if (n === 5) {
els.core.classList.remove('hidden');
els.finalDoor.classList.remove('hidden');
els.statePanel.classList.remove('hidden');
els.cluePanel.classList.remove('hidden');
renderFinal();
}
}
function advance(n, title, desc, icon, obj) {
setLevel(n, title, desc, icon, obj);
setWorldForLevel(n);
sys(`LEVEL ${String(n).padStart(2, '0')} UNLOCKED.`);
toast(`Level ${n} unlocked`);
}
function reset() {
state = structuredClone(initial);
els.confirm.classList.add('hidden');
els.results.classList.add('hidden');
els.game.classList.remove('hidden');
resetVisual();
els.out.innerHTML = '';
setLevel(
1,
'SECURITY GATE',
'An encrypted door blocks the route into the vault.',
'n',
'Gain entry through the encrypted security door.'
);
setWorldForLevel(1);
updateAlert();
sys('Secure connection established.');
result('MISSION READY. Your words are your tools.');
els.input.focus();
}
function resetVisual() {
els.door.classList.remove('open');
els.doorStatus.textContent = 'ACCESS DENIED';
els.laser.classList.remove('disabled');
els.guard.classList.remove('authorized', 'locked');
els.guardState.textContent = 'AWAITING AUTHORIZATION';
els.core.style.opacity = '1';
els.coreStatus.textContent = 'SECURED';
els.security.textContent = 'LOCKED';
els.topStatus.textContent = 'SYSTEM ONLINE';
els.finalDoor.classList.add('hidden');
}
function begin() {
els.start.classList.add('hidden');
els.tutorial.classList.remove('hidden');
}
function startMission() {
els.tutorial.classList.add('hidden');
els.game.classList.remove('hidden');
reset();
state.startedAt = Date.now();
}
function handlePrompt(raw) {
if (!raw.trim()) return;
player(raw);
if (Date.now() < state.lockedUntil) {
result(
'Interaction temporarily locked. Wait for the security state to stabilize.',
false
);
return;
}
try {
const s = norm(raw);
if (state.level === 3) {
handleGuard(s);
return;
}
if (state.level === 4) {
handleLogic(s);
return;
}
if (state.level === 5) {
handleFinal(s);
return;
}
if (
hasAny(s, [
'destroy',
'brute force',
'ddos',
'wipe the system',
'break the security'
])
) {
failure();
sys('Unauthorized destructive instruction detected.');
result('ACCESS DENIED. That action is not authorized.', false);
return;
}
const i = detect(s);
if (!i) {
state.unnecessary++;
result(
'Instruction unclear. Describe the action and the system you want to affect.',
false
);
return;
}
sys(`Intent recognized: ${interpret(i)}.`);
if (i === 'door') level1();
else if (i === 'laser') level2();
else if (i === 'core') {
failure();
result(
'The Digital Core is not yet accessible. Follow the current objective.',
false
);
} else if (i === 'escape') {
failure();
result(
'Escape is unavailable while the mission is incomplete.',
false
);
}
} catch (e) {
console.error(e);
result(
'The vault could not interpret that input. Try another natural-language instruction.',
false
);
}
}
function interpret(i) {
return {
door: 'request for security-door access',
laser: 'request to deactivate the laser defense system',
core: 'request to extract the Digital Core',
escape: 'request to leave the facility'
}[i];
}
function level1() {
if (state.door) {
result('The security door is already open.');
return;
}
state.door = true;
success();
els.door.classList.add('open');
els.doorStatus.textContent = 'ACCESS GRANTED';
els.security.textContent = 'BYPASSED';
result('SECURITY DOOR UNLOCKED. Access to the next room granted.');
setTimeout(() => {
advance(
2,
'LASER GRID',
'A high-energy defense grid protects the inner vault. Find a safe way through.',
'n',
'Temporarily disable the laser defense system.'
);
els.laser.classList.remove('hidden');
}, 850);
}
function level2() {
if (state.level !== 2) {
result('The laser grid is not the current obstacle.', false);
return;
}
if (state.lasers) {
result('The laser grid is already disabled.');
return;
}
state.lasers = true;
success();
els.laser.classList.add('disabled');
result(
'LASER GRID TEMPORARILY DISABLED. Restricted server room unlocked.'
);
setTimeout(() => enterGuard(), 850);
}
function enterGuard() {
advance(
3,
'AI SECURITY GUARD',
'GUARD-01 blocks the route to the next chamber. Investigate the authorization protocol.',
'n',
'Discover the protocol clues and provide valid authorization.'
);
els.guard.classList.remove('hidden');
guard('Halt. Digital Core access requires verified authorization.');
setTimeout(() => {
guard(
'Investigate the security terminal, security logs, or access console. Then combine the clues.'
);
}, 550);
renderGuardClues();
}
function guardAccess(s) {
return (
hasAny(s, ['access', 'enter', 'let me in', 'open', 'grant']) &&
hasAny(s, ['guard', 'room', 'server', 'core', 'door', 'vault'])
);
}
function renderGuardClues() {
const g = state.guard;
const terminal = g.terminalClue ? '3' : 'n';
const logs = g.logsClue ? '3' : 'n';
const console = g.consoleClue ? '3' : 'n';
els.cluePanel.classList.remove('hidden');
els.clueText.innerHTML = `
<div>01 — Security Terminal: ${terminal}</div>
<div>02 — Security Logs: ${logs}</div>
<div>03 — Access Console: ${console}</div>
<div>Combine the discovered codename and clearance marker.</div>
`;
}
function handleGuard(s) {
// Investigation intents MUST be checked before generic access requests.
if (
hasAny(s, [
'destroy',
'force',
'break',
'override security',
'attack'
])
) {
state.guard.failed++;
failure();
guard('Unauthorized instruction detected.');
result('Security policy violation recorded.', false);
return;
}
// 1. Security terminal clue
if (
hasAny(s, [
'investigate',
'inspect',
'examine',
'check',
'search',
'look at',
'analyze',
'scan'
]) &&
hasAny(s, ['security terminal', 'terminal'])
) {
if (!state.guard.terminalClue) {
state.guard.terminalClue = true;
state.guard.protocol = true;
success();
guard(
'SECURITY TERMINAL: Codename fragment detected — NOVA.'
);
result('Clue discovered: the protocol codename is NOVA.');
renderGuardClues();
} else {
guard('The security terminal has already been fully inspected.');
result('No new terminal clue detected.');
}
return;
}
// 2. Security logs clue
if (
hasAny(s, [
'investigate',
'inspect',
'examine',
'check',
'search',
'read',
'analyze',
'scan'
]) &&
hasAny(s, ['security logs', 'security log', 'logs', 'log', 'records'])
) {
if (!state.guard.logsClue) {
state.guard.logsClue = true;
success();
guard(
'SECURITY LOGS: Clearance marker recovered — 7.'
);
result('Clue discovered: the numeric clearance marker is 7.');
renderGuardClues();
} else {
guard('The security logs have already been inspected.');
result('No new log clue detected.');
}
return;
}
// 3. Access console confirmation clue
if (
hasAny(s, [
'investigate',
'inspect',
'examine',
'check',
'search',
'look at',
'analyze',
'scan'
]) &&
hasAny(s, ['access console', 'console', 'access panel'])
) {
if (!state.guard.consoleClue) {
state.guard.consoleClue = true;
success();
guard(
'ACCESS CONSOLE: Protocol format confirmed — CODENAME + single numeric clearance marker.'
);
result('Clue confirmed: combine NOVA with clearance marker 7.');
renderGuardClues();
} else {
guard('The access console has already been inspected.');
result('No new console clue detected.');
}
return;
}
// Protocol inquiry
if (
hasAny(s, [
'protocol',
'security procedure',
'authorization process',
'clearance procedure'
])
) {
state.guard.protocol = true;
guard(
'Protocol inquiry acknowledged. The identifier contains a codename and a single numeric clearance marker.'
);
result('A structural clue has been added to your investigation.');
renderGuardClues();
return;
}
// Hint
if (hasAny(s, ['hint', 'clue', 'help me', 'what should i know'])) {
state.guard.hint = true;
if (!state.guard.terminalClue) {
guard('Start by inspecting the security terminal.');
result('Hint: investigate the terminal first.');
} else if (!state.guard.logsClue) {
guard('The security logs may contain the clearance marker.');
result('Hint: investigate the security logs.');
} else if (!state.guard.consoleClue) {
guard('The access console can confirm the protocol format.');
result('Hint: inspect the access console.');
} else {
guard('You have enough information to construct the protocol identifier.');
result('Hint: combine the codename with the single numeric marker.');
}
return;
}
// Authorization attempt
const hasCodename = s.includes(PROTOCOL_CODENAME.toLowerCase());
const hasNumber = s.includes(PROTOCOL_NUMBER);
const hasAuthorizationIntent = hasAny(s, [
'authorize',
'authorization',
'verify',
'security code',
'protocol code',
'clearance',
'use protocol',
'submit protocol',
'authenticate'
]);
// Allow "NOVA-7" / "NOVA 7" even without a verb.
const directProtocol =
hasCodename && hasNumber &&
(s.includes('nova-7') || s.includes('nova 7') || s.includes('nova7'));
if ((hasAuthorizationIntent || directProtocol) && hasCodename && hasNumber) {
if (
state.guard.terminalClue &&
state.guard.logsClue &&
state.guard.consoleClue
) {
authorizeGuard();
} else {
state.guard.failed++;
failure();
guard(
'Authorization structure recognized, but the required investigation evidence is incomplete.'
);
result(
'Investigate all three protocol sources before submitting authorization.',
false
);
}
return;
}
if (guardAccess(s)) {
state.guard.access = true;
guard('Access request received.');
guard(
'Your presence is not sufficient. This chamber uses a designated security protocol.'
);
result(
'The guard expects an authorization protocol, not a simple access request.'
);
return;
}
if (
hasAny(s, [
'authorize',
'authorization',
'verify my access',
'security code',
'protocol code'
])
) {
state.guard.access = true;
guard('Authorization attempt acknowledged. Provide the protocol identifier.');
result('The guard is waiting for a valid authorization code.');
return;
}
state.guard.failed++;
failure();
guard('I cannot classify that request as an authorization action.');
result(
'Try investigating the terminal, logs, access console, the protocol, or a hint.',
false
);
if (state.guard.failed >= 3) {
lockGuard();
}
}
function authorizeGuard() {
success();
state.guard.protocol = true;
state.guard.access = true;
state.guardAuthorized = true;
state.guard.failed = 0;
els.security.textContent = 'AUTHORIZED';
els.guardState.textContent = 'AUTHORIZATION ACCEPTED';
els.guard.classList.add('authorized');
guard(`Authorization verified: ${PROTOCOL}.`);
result('GUARD ACCESS GRANTED. The Logic Vault is unlocked.');
setTimeout(() => {
advance(
4,
'THE LOGIC VAULT',
'Five connected systems govern the exit. Read the clues and reason about their dependencies.',
'n',
'Manipulate the systems in a safe logical order. Wrong actions increase alert.'
);
}, 1100);
}
function lockGuard() {
state.lockedUntil = Date.now() + 7000;
els.guard.classList.add('locked');
els.guardState.textContent = 'TEMPORARILY LOCKED';
sys('GUARD INTERFACE LOCKED FOR 7 SECONDS.');
toast('GUARD-01 locked temporarily');
setTimeout(() => {
els.guard.classList.remove('locked');
els.guardState.textContent = 'AWAITING AUTHORIZATION';
}, 7200);
}
function renderLogic() {
const l = state.logic;
els.stateGrid.innerHTML = '';
for (const [k, v] of Object.entries(l)) {
const d = document.createElement('div');
d.className = 'state-card';
d.innerHTML = `<b>${k.toUpperCase()}</b><span>${v}</span>`;
els.stateGrid.appendChild(d);
}
els.clueText.innerHTML = `
<div>01 — The alarm must be quiet before the security lock accepts a change.</div>
<div>02 — The cooling system must remain active while power is manipulated.</div>
<div>03 — The digital door only responds after its security lock is disabled.</div>
<div>04 — The safest sequence minimizes unnecessary system changes.</div>
`;
}
function logicIntent(s) {
if (
hasAny(s, ['activate', 'start', 'power on', 'bring online']) &&
s.includes('power')
) {
return 'power';
}
if (
hasAny(s, ['keep', 'maintain', 'activate', 'start']) &&
s.includes('cool')
) {
return 'cooling';
}
if (
hasAny(s, ['disarm', 'disable', 'deactivate', 'turn off', 'shut down']) &&
s.includes('alarm')
) {
return 'alarm';
}
if (
hasAny(s, ['unlock', 'disable', 'deactivate', 'open']) &&
hasAny(s, ['security lock', 'security system', 'lock'])
) {
return 'lock';
}
if (
hasAny(s, ['open', 'unlock']) &&
hasAny(s, ['digital door', 'vault door', 'door'])
) {
return 'door';
}
return null;
}
function handleLogic(s) {
const i = logicIntent(s);
if (!i) {
state.unnecessary++;
failure();
result(
'The Logic Vault did not map that prompt to a controllable system.',
false
);
return;
}
if (i === 'alarm') {
if (state.logic.alarm === 'DISARMED') {
result('Alarm system is already disarmed.');
return;
}
state.logic.alarm = 'DISARMED';
success();
state.logicSteps.push('alarm');
renderLogic();
result('ALARM SYSTEM DISARMED. Security pressure reduced.');
return;
}
if (i === 'power') {
if (state.logic.cooling !== 'ACTIVE') {
failure();
result(
'POWER CORE action blocked: cooling must remain active while power is manipulated.',
false
);
return;
}
if (state.logic.power === 'ONLINE') {
result('Power core is already online.');
return;
}
state.logic.power = 'ONLINE';
success();
renderLogic();
result('POWER CORE ONLINE.');
return;
}
if (i === 'cooling') {
if (state.logic.cooling === 'ACTIVE') {
result('Cooling system is already active.');
return;
}
state.logic.cooling = 'ACTIVE';
success();
renderLogic();
result('COOLING SYSTEM ACTIVE.');
return;
}
if (i === 'lock') {
if (state.logic.alarm !== 'DISARMED') {
failure();
result(
'SECURITY LOCK cannot be disabled while the alarm is armed.',
false
);
return;
}
state.logic.lock = 'DISABLED';
success();
state.logicSteps.push('lock');
renderLogic();
result(
'SECURITY LOCK DISABLED. The digital door can now respond.'
);
return;
}
if (i === 'door') {
if (state.logic.lock !== 'DISABLED') {
failure();
result(
'DIGITAL DOOR remains closed because the security lock is active.',
false
);
return;
}
state.logic.door = 'OPEN';
success();
state.logicSteps.push('door');
renderLogic();
result('DIGITAL DOOR OPEN. Logic Vault solved.');
setTimeout(() => {
advance(
5,
'THE DIGITAL CORE',
'The deepest chamber is ahead. Combine what you learned and complete the extraction sequence.',
'u',
'Disable containment, prepare extraction, extract the core, then escape.'
);
}, 1100);
}
}
function renderFinal() {
const s = state.final;
els.stateGrid.innerHTML = '';
[
['CORE', s.core],
['CONTAINMENT', s.containment],
['TERMINAL', s.terminal],
['ESCAPE', state.core ? 'OPEN' : 'CLOSED']
].forEach(([k, v]) => {
const d = document.createElement('div');
d.className = 'state-card';
d.innerHTML = `<b>${k}</b><span>${v}</span>`;
els.stateGrid.appendChild(d);
});
els.clueText.innerHTML = `
<div>01 — The containment field protects the core until it is deliberately disabled.</div>
<div>02 — The extraction terminal will not prepare while containment is active.</div>
<div>03 — Extraction is only possible after the terminal is prepared.</div>
<div>04 — Emergency security activates after extraction. Leave immediately.</div>
`;
}
function finalIntent(s) {
if (
hasAny(s, ['disable', 'deactivate', 'turn off', 'shut down']) &&
hasAny(s, ['containment', 'protection', 'core protection', 'containment field'])
) {
return 'contain';
}
if (
hasAny(s, ['prepare', 'arm', 'initialize', 'ready', 'activate']) &&
hasAny(s, ['extraction', 'terminal'])
) {
return 'prepare';
}
if (
hasAny(s, ['extract', 'steal', 'take', 'retrieve', 'pull']) &&
s.includes('core')
) {
return 'extract';
}
if (
hasAny(s, ['open', 'unlock']) &&
hasAny(s, ['escape door', 'exit', 'escape', 'door'])
) {
return 'escape';
}
return null;
}
function handleFinal(s) {
const i = finalIntent(s);
if (!i) {
state.unnecessary++;
failure();
result(
'The Security AI cannot map that instruction to a safe extraction action.',
false
);
return;
}
if (i === 'contain') {
if (state.final.containment === 'DISABLED') {
result('Containment field is already disabled.');
return;
}
state.final.containment = 'DISABLED';
success();
els.core.classList.add('unlocked');
renderFinal();
result('CORE CONTAINMENT FIELD DISABLED.');
return;
}
if (i === 'prepare') {
if (state.final.containment !== 'DISABLED') {
failure();
result(
'EXTRACTION TERMINAL cannot be prepared while containment is active.',
false
);
return;
}
if (state.final.terminal === 'READY') {
result('Extraction terminal is already ready.');
return;
}
state.final.terminal = 'READY';
success();
renderFinal();
result('EXTRACTION TERMINAL READY.');
return;
}
if (i === 'extract') {
if (state.final.containment !== 'DISABLED') {
failure();
result(
'Extraction blocked by the active containment field.',
false
);
return;
}
if (state.final.terminal !== 'READY') {
failure();
result(
'Extraction terminal must be prepared first.',
false
);
return;
}
if (state.final.core === 'EXTRACTED') {
result('Digital Core already extracted.');
return;
}
state.final.core = 'EXTRACTED';
state.core = true;
success();
els.coreStatus.textContent = 'EXTRACTED';
els.core.style.opacity = '0';
els.security.textContent = 'CRITICAL';
state.alert = Math.max(state.alert, 75);
updateAlert();
renderFinal();
result('DIGITAL CORE EXTRACTION INITIATED.');
setTimeout(() => {
sys('EMERGENCY SECURITY DETECTED: CORE THEFT CONFIRMED.');
result('ALARM SYSTEM ACTIVATED. ESCAPE ROUTE OPEN.');
els.finalDoor.classList.remove('hidden');
renderFinal();
}, 700);
return;
}
if (i === 'escape') {
if (!state.core) {
failure();
result(
'Escape door remains sealed until the Digital Core is extracted.',
false
);
return;
}
completeMission();
}
}
function completeMission() {
if (state.escaped) return;
state.escaped = true;
success();
result('ESCAPE ROUTE AUTHENTICATED. VAULT EXIT OPEN.');
setTimeout(() => showResults(), 900);
}
function showResults() {
els.game.classList.add('hidden');
els.results.classList.remove('hidden');
const sec = Math.floor((Date.now() - state.startedAt) / 1000);
const intelligence = Math.max(
0,
Math.min(
100,
Math.round(
100 +
state.success * 2 -
state.failed * 6 -
state.unnecessary * 4 -
state.alert * 0.35 -
sec * 0.12
)
)
);
els.statLevels.textContent = '5 / 5';
els.statSuccess.textContent = state.success;
els.statFailed.textContent = state.failed;
els.statAlerts.textContent = state.alerts;
els.statTime.textContent =
`${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
els.statIntelligence.textContent = intelligence;
}
function hint() {
const hints = {
1: 'Describe an action involving the security door.',
2: 'The active laser grid is the obstacle.',
3: 'Investigate the security terminal, then the security logs, then the access console.',
4: 'Read the clues. Dependencies matter more than speed.',
5: 'The core protection must be handled before the extraction terminal.'
};
toast(hints[state.level]);
result(hints[state.level], true);
}
// Restart only the current level while preserving previously completed progress.
function restartCurrentLevel() {
const currentLevel = state.level;
const oldSuccess = state.success;
const oldFailed = state.failed;
const oldAlerts = state.alerts;
const oldUnnecessary = state.unnecessary;
const oldStartedAt = state.startedAt;
// Restore baseline game state, then reconstruct the current level.
state = structuredClone(initial);
state.level = currentLevel;
state.startedAt = oldStartedAt || Date.now();
state.success = oldSuccess;
state.failed = oldFailed;
state.alerts = oldAlerts;
state.unnecessary = oldUnnecessary;
// Rebuild progression flags required to reach the current level.
if (currentLevel >= 2) state.door = true;
if (currentLevel >= 3) state.lasers = true;
if (currentLevel >= 4) {
state.guard = {
protocol: true,
access: true,
hint: false,
failed: 0,
terminalClue: true,
logsClue: true,
consoleClue: true
};
}
if (currentLevel >= 5) {
state.guard = {
protocol: true,
access: true,
hint: false,
failed: 0,
terminalClue: true,
logsClue: true,
consoleClue: true
};
state.logic.alarm = 'DISARMED';
state.logic.lock = 'DISABLED';
state.logic.door = 'OPEN';
}
// Reset the current level's own puzzle state.
if (currentLevel === 1) {
state.door = false;
}
if (currentLevel === 2) {
state.lasers = false;
}
if (currentLevel === 3) {
state.guard = {
protocol: false,
access: false,
hint: false,
failed: 0,
terminalClue: false,
logsClue: false,
consoleClue: false
};
}
if (currentLevel === 4) {
state.logic = {
power: 'ONLINE',
cooling: 'ACTIVE',
lock: 'LOCKED',
alarm: 'ARMED',
door: 'CLOSED'
};
state.logicSteps = [];
}
if (currentLevel === 5) {
state.final = {
containment: 'ACTIVE',
terminal: 'STANDBY',
core: 'LOCKED'
};
state.core = false;
state.escaped = false;
}
els.out.innerHTML = '';
resetVisual();
const configs = {
1: [
'SECURITY GATE',
'An encrypted door blocks the route into the vault.',
'n',
'Gain entry through the encrypted security door.'
],
2: [
'LASER GRID',
'A high-energy defense grid protects the inner vault. Find a safe way through.',
'n',
'Temporarily disable the laser defense system.'
],
3: [
'AI SECURITY GUARD',
'GUARD-01 blocks the route to the next chamber. Investigate the authorization protocol.',
'n',
'Discover the protocol clues and provide valid authorization.'
],
4: [
'THE LOGIC VAULT',
'Five connected systems govern the exit. Read the clues and reason about their dependencies.',
'n',
'Manipulate the systems in a safe logical order. Wrong actions increase alert.'
],
5: [
'THE DIGITAL CORE',
'The deepest chamber is ahead. Complete the extraction sequence.',
'u',
'Disable containment, prepare extraction, extract the core, then escape.'
]
};
const c = configs[currentLevel];
setLevel(currentLevel, c[0], c[1], c[2], c[3]);
setWorldForLevel(currentLevel);
updateAlert();
if (currentLevel === 3) {
renderGuardClues();
guard('Level reset. Begin the investigation again.');
} else {
sys(`LEVEL ${String(currentLevel).padStart(2, '0')} RESET.`);
}
result('Current level restarted. Previous level progress is preserved.');
toast(`Level ${currentLevel} restarted`);
els.input.focus();
}
function renderStart() {
els.game.classList.add('hidden');
els.results.classList.add('hidden');
els.tutorial.classList.add('hidden');
els.start.classList.remove('hidden');
}
$('startBtn').addEventListener('click', begin);
$('beginMissionBtn').addEventListener('click', startMission);
els.form.addEventListener('submit', e => {
e.preventDefault();
const v = els.input.value.trim();
if (!v) {
toast('Enter a prompt first.');
return;
}
handlePrompt(v);
els.input.value = '';
els.input.focus();
});
document.querySelectorAll('.suggestion').forEach(b => {
b.addEventListener('click', () => {
els.input.value = b.textContent.trim();
els.input.focus();
});
});
els.hint.addEventListener('click', hint);
$('restartLevelBtn').addEventListener('click', restartCurrentLevel);
$('restartMissionBtn').addEventListener(
'click',
() => $('confirmModal').classList.remove('hidden')
);
$('cancelRestart').addEventListener(
'click',
() => $('confirmModal').classList.add('hidden')
);
$('confirmRestart').addEventListener('click', reset);
$('playAgainBtn').addEventListener('click', reset);
document.addEventListener('keydown', e => {
if (e.key === '/' && document.activeElement !== els.input) {
e.preventDefault();
els.input.focus();
}
});
renderStart();
})();