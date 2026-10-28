// 화면이 실제 OS 에 닿는 API.
// vmware.sh(Electron)에서는 preload 가 넣어 준 window.topology 를 쓰고,
// run.sh(로컬 서버)에서는 주소의 token 으로 /api 를 호출한다.
const NAMES = ['places', 'listDir', 'open', 'exec', 'sysInfo', 'netInfo', 'apps', 'launch', 'loadProgram', 'saveProgram', 'saveDesign', 'quit'];
const token = new URLSearchParams(location.search).get('token') ?? '';

async function call(name, ...args) {
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Topology-Token': token },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  return res.json();
}

export const api = window.topology ?? Object.fromEntries(NAMES.map((name) => [name, (...args) => call(name, ...args)]));
