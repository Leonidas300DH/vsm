import test from "node:test";
import assert from "node:assert/strict";
import {
  providerRequest,
  callProvider,
  configuration,
} from "../server/adapters.mjs";
import { createLocalServer } from "../server/index.mjs";
const env = {
  VSM_AI_ENABLED: "true",
  OPENAI_API_KEY: "test-only-secret",
  ANTHROPIC_API_KEY: "test-only-secret",
  GEMINI_API_KEY: "test-only-secret",
};
test("three provider contracts keep keys in headers, output bounded and status redacted", async () => {
  assert.ok(!JSON.stringify(configuration(env)).includes("test-only-secret"));
  for (const provider of ["openai", "claude", "gemini"]) {
    const r = providerRequest(provider, "test-model", { fixture: true }, env);
    assert.ok(!JSON.stringify(r.body).includes("test-only-secret"));
    assert.ok(!r.url.includes("test-only-secret"));
    const obj = { contractVersion: "1.0" };
    const payload =
      provider === "openai"
        ? {
            output: [
              { content: [{ type: "output_text", text: JSON.stringify(obj) }] },
            ],
          }
        : provider === "claude"
          ? { content: [{ type: "text", text: JSON.stringify(obj) }] }
          : {
              candidates: [
                { content: { parts: [{ text: JSON.stringify(obj) }] } },
              ],
            };
    assert.deepEqual(
      await callProvider(provider, "model", {}, env, {
        fetchImpl: async () => new Response(JSON.stringify(payload)),
      }),
      obj,
    );
  }
});
test("missing key, refusal, rate limit, malformed response, timeout, cancellation: no retry", async () => {
  assert.throws(
    () => providerRequest("openai", "model", {}, {}),
    /Clé absente/,
  );
  for (const status of [401, 429]) {
    let calls = 0;
    await assert.rejects(
      callProvider("openai", "model", {}, env, {
        fetchImpl: async () => {
          calls++;
          return new Response("{}", { status });
        },
      }),
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    callProvider("openai", "model", {}, env, {
      fetchImpl: async () => new Response("bad"),
    }),
    /invalide/,
  );
  const hanging = async (url, { signal }) =>
    new Promise((resolve, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      }),
    );
  const keepAlive = setTimeout(() => {}, 100);
  await assert.rejects(
    callProvider("openai", "model", {}, env, {
      fetchImpl: hanging,
      timeoutMs: 5,
    }),
    /Délai/,
  );
  clearTimeout(keepAlive);
  const controller = new AbortController();
  const promise = callProvider("openai", "model", {}, env, {
    fetchImpl: hanging,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(promise, /annulée/);
});
test("local server denies remote origins, does not expose keys, disables analysis by default", async () => {
  const server = createLocalServer({
    env: { OPENAI_API_KEY: "test-only-secret" },
    fetchImpl: () => {
      throw new Error("Must not call provider");
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const config = await (await fetch(url + "/api/config")).text();
    assert.ok(!config.includes("test-only-secret"));
    assert.equal(
      (
        await fetch(url + "/api/config", {
          headers: { origin: "https://vsm-mauve.vercel.app" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(url + "/api/analyze", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-vsm-request": "analysis",
          },
          body: "{}",
        })
      ).status,
      403,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('local server validates proposals and admits only one explicit request at a time',async()=>{
  const pack={source:{scenarioId:'s',revision:0},scenario:{id:'s',revision:0,nodes:[{id:'input',type:'startEnd',data:{type:'start',volumeItems:[{id:'a',name:'A',value:10}]}},{id:'n',type:'process',data:{cycleTimes:{a:2}}}],edges:[]}};
  const proposal={contractVersion:'1.0',source:pack.source,name:'Target',proposals:[{id:'p',objectIds:['n'],rationale:'Reason',assumptions:[],alternatives:{human:'Human',it:'IT',agent:'Agent'},costs:{amount:null,currency:'EUR',period:'month',basis:'Unknown'},supervision:'Review',exceptions:'Escalate',changes:[{kind:'nodes',id:'n',field:'cycle',category:'a',value:1}]}]};
  let release,started;const began=new Promise(resolve=>started=resolve);
  const server=createLocalServer({env,fetchImpl:async()=>{started();await new Promise(resolve=>release=resolve);return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(proposal)}]}]}));}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}/api/analyze`,options={method:'POST',headers:{'content-type':'application/json','x-vsm-request':'analysis'},body:JSON.stringify({provider:'openai',model:'test',package:pack})};
  try{const first=fetch(url,options);await began;assert.equal((await fetch(url,options)).status,409);release();const r=await first;assert.equal(r.status,200);assert.equal((await r.json()).source.revision,0);}finally{await new Promise(resolve=>server.close(resolve));}
});
