// 隔离浏览器上下文验证实际main/UI输出；不接触玩家浏览器或其存档。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createGame } from "../tests/harness.mjs";
const option = (name, fallback) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const modulePath = option("--playwright", "playwright");
const { chromium } = await import(modulePath === "playwright" ? modulePath : pathToFileURL(resolve(modulePath)).href);
const url = option("--url", "http://127.0.0.1:8083/");
const output = option("--output-dir", "/tmp/trinity-bilingual-review");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: option("--channel", undefined) });
const errors = [], consoleErrors = [], requests = [], checks = [];
try {
  async function pageFor(save, viewport = { width: 1280, height: 960 }) {
    const context = await browser.newContext({ viewport });
    // 既有站点没有favicon；只屏蔽该无关404，其余控制台错误必须失败。
    await context.route("**/favicon.ico", route => route.fulfill({ status: 204 }));
    if (save) await context.addInitScript(data => localStorage.setItem(`trinity-relit:save:v${data.version}`, JSON.stringify(data)), save);
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("request", request => { if (/vendor\/intent|huggingface/.test(request.url())) requests.push(request.url()); });
    await page.goto(url);
    if (save) await page.getByRole("button", { name: "继续上次冒险", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector("#input").disabled);
    await page.evaluate(() => {
      document.querySelector("#output").style.scrollBehavior = "auto";
      window.render_game_to_text = () => JSON.stringify({ text: document.querySelector("#output").innerText });
      window.advanceTime = async () => {};
    });
    return page;
  }
  async function submit(page, input) {
    const start = await page.locator("#output > div").count();
    await page.locator("#input").fill(input);
    await page.locator("#input").press("Enter");
    await page.waitForFunction(() => !document.querySelector("#input").disabled);
    const response = await page.locator("#output > div").evaluateAll((nodes, index) => nodes.slice(index).map(node => node.innerText).join("\n"), start);
    assert.doesNotMatch(response, /这句话无法识别|暂时无法确定你的意思|错误：|处理指令时遇到问题，请重试/);
    return response;
  }
  async function screenshot(page, name) {
    await page.evaluate(() => { const log = document.querySelector("#output"); log.scrollTop = log.scrollHeight; });
    await page.waitForFunction(() => { const log = document.querySelector("#output"); return log.scrollHeight - log.clientHeight - log.scrollTop < 2; });
    await page.screenshot({ path: `${output}/${name}.png` });
  }
  async function verifyParagraphs(page, label) {
    const blocks = await page.locator("#output > div").evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll(".scene-text")].map(p => ({ text: p.textContent, zh: p.classList.contains("lang-zh") }))).filter(block => block.length));
    for (const block of blocks) {
      for (const [i, paragraph] of block.entries()) {
        if (!paragraph.zh && /[a-z]/i.test(paragraph.text)) {
          assert.ok(block[i + 1]?.zh, `${label}：英文之后缺少中文：${paragraph.text}`);
        }
      }
    }
    assert.ok(blocks.length > 0);
    checks.push({ label, outputBlocks: blocks.length });
    writeFileSync(`${output}/${label}.txt`, await page.evaluate(() => window.render_game_to_text()));
  }
  const cries = await pageFor();
  for (const input of ["n", "wait", "look"]) await submit(cries, input);
  const cryPairs = await cries.locator(".lang-en").evaluateAll(nodes => nodes.filter(node => /cries the bird woman/.test(node.textContent)).map(node => ({ en: node.textContent, cn: node.nextElementSibling?.textContent, zh: node.nextElementSibling?.classList.contains("lang-zh") })));
  assert.ok(cryPairs.length >= 3);
  assert.ok(cryPairs.every(pair => pair.zh && /三十便士/.test(pair.cn)));
  await verifyParagraphs(cries, "bird-cries-desktop");
  await screenshot(cries, "bird-cries-desktop");
  const mobile = await pageFor(undefined, { width: 390, height: 844 });
  for (const input of ["n", "wait", "look"]) await submit(mobile, input);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.ok(await mobile.locator("#input").isVisible());
  await verifyParagraphs(mobile, "bird-cries-mobile");
  await screenshot(mobile, "bird-cries-mobile");
  await submit(cries, "buy crumbs");
  await submit(cries, "feed birds");
  assert.doesNotMatch(await submit(cries, "wait"), /cries the bird woman/);
  await verifyParagraphs(cries, "birds-fed");

  const sundial = await pageFor();
  await submit(sundial, "ne"); await submit(sundial, "examine sundial");
  assert.match(await sundial.locator("#output").innerText(), /卡罗尔/);
  await verifyParagraphs(sundial, "sundial-quote");
  await screenshot(sundial, "sundial-quote");

  const woman = await pageFor();
  for (const input of ["n", "ne", "wait"]) await submit(woman, input);
  assert.match(await woman.locator("#output").innerText(), /蒲柏/);
  await verifyParagraphs(woman, "pope-quote");
  await screenshot(woman, "pope-quote");
  await submit(woman, "e"); await submit(woman, "help woman");
  await verifyParagraphs(woman, "umbrella-woman");
  await screenshot(woman, "umbrella-woman");

  // 定点状态用于显示深层回调；正常开局路线在上方独立验证。
  const doomGame = createGame(); doomGame.state.timer.remaining = 11;
  const doom = await pageFor(doomGame.eng.serialize());
  await submit(doom, "wait");
  assert.match(await doom.locator("#output").innerText(), /梭罗/);
  await verifyParagraphs(doom, "thoreau-quote");
  await screenshot(doom, "thoreau-quote");

  const animalGame = createGame();
  await animalGame.eng.activateChapter("ranch");
  animalGame.state.chapter = "ranch"; animalGame.state.room = "kitchen"; animalGame.state.clearTimer();
  animalGame.state.destroy("magpie"); animalGame.state.take("cage"); animalGame.state.putIn("roadrunner", "cage");
  animalGame.state.animals.roadrunner = { active: true, grace: 0, prepared: true, takeable: true };
  const animal = await pageFor(animalGame.eng.serialize());
  const escape = await submit(animal, "open cage");
  assert.match(escape, /nudges open the outer door/); assert.match(escape, /外门.*狡黠/);
  await verifyParagraphs(animal, "animal-door");
  await screenshot(animal, "animal-door");

  const paperGame = createGame(); paperGame.state.clearTimer();
  paperGame.state.take("paper_bird"); paperGame.state.setFlag("bird_unfolded");
  const paper = await pageFor(paperGame.eng.serialize());
  assert.match(await submit(paper, "examine paper"), /长水湖，四点钟/);
  await verifyParagraphs(paper, "paper-away-from-pond");
  await screenshot(paper, "paper-away-from-pond");
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleErrors, []);
  assert.deepEqual(requests, []);
  const result = { passed: true, checks, pageErrors: errors, consoleErrors, modelRequests: requests, birdCryPairs: cryPairs.length };
  writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
