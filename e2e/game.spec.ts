import { test, expect, type Page } from '@playwright/test';

async function reveal(page: Page) {
  const card = page.locator('.secret-card');
  await card.focus();
  await page.keyboard.down('Space');
  await expect(card).toHaveClass(/is-revealed/);
  const imposter = (await card.locator('.eyebrow').textContent())!.includes('IMPOSTER');
  const word = imposter ? undefined : (await card.locator('strong').textContent())!;
  await page.keyboard.up('Space');
  await expect(card).not.toHaveClass(/is-revealed/);
  return { imposter, word };
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}

test('three isolated browsers play, refresh, vote, guess and replay across desktop and mobile', async ({
  browser,
}, testInfo) => {
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' }),
    browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    }),
    browser.newContext({ viewport: { width: 768, height: 1024 }, reducedMotion: 'reduce' }),
  ]);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  pages.forEach((page) => page.on('pageerror', (error) => errors.push(error.message)));
  try {
    await Promise.all(pages.map((p) => p.goto('http://localhost:5173')));
    await Promise.all(pages.map((p) => expect(p.getByText('ALL SYSTEMS GO')).toBeAttached()));
    await Promise.all(pages.map(noOverflow));
    await pages[0].screenshot({ path: testInfo.outputPath('landing-desktop.png'), fullPage: true });
    await pages[1].screenshot({ path: testInfo.outputPath('landing-mobile.png'), fullPage: true });
    await pages[0].getByRole('button', { name: /Create a room/ }).click();
    await pages[0].getByLabel('Your nickname').fill('Aster');
    await pages[0].getByRole('button', { name: 'Create my room' }).click();
    await expect(
      pages[0].getByRole('heading', { name: 'The crew’s coming together.' }),
    ).toBeVisible();
    const code = (await pages[0].locator('.room-code').textContent())!;
    for (const [index, name] of [
      [1, 'Billie'],
      [2, 'Casey'],
    ] as const) {
      await pages[index].goto(`http://localhost:5173/?room=${code}`);
      await pages[index].getByLabel('Your nickname').fill(name);
      await pages[index].getByRole('button', { name: 'Join the room' }).click();
    }
    await Promise.all(pages.map((p) => expect(p.locator('.player-line')).toHaveCount(3)));
    await pages[1].reload();
    await expect(pages[1].locator('.room-code')).toHaveText(code);
    await expect(pages[1].locator('.player-line')).toHaveCount(3);
    await pages[1].screenshot({ path: testInfo.outputPath('lobby-mobile.png'), fullPage: true });
    await pages[0].getByRole('button', { name: 'Start the game' }).click();
    await Promise.all(
      pages.map((p) =>
        expect(p.getByRole('heading', { name: 'Every face hides a secret.' })).toBeVisible(),
      ),
    );
    const roles = [];
    for (const page of pages) roles.push(await reveal(page));
    expect(roles.filter((r) => r.imposter)).toHaveLength(1);
    expect(new Set(roles.filter((r) => !r.imposter).map((r) => r.word)).size).toBe(1);
    const imposter = roles.findIndex((r) => r.imposter);
    const word = roles.find((r) => !r.imposter)!.word!;
    await pages[1].screenshot({ path: testInfo.outputPath('reveal-mobile.png'), fullPage: true });
    for (const page of pages)
      await page.getByRole('button', { name: 'I know my assignment' }).click();
    const imposterSession = await pages[imposter].evaluate(() =>
      localStorage.getItem('undercover.session.v1'),
    );
    await pages[imposter].reload();
    await expect(pages[imposter].locator('.secret-compact')).toBeVisible();
    expect(
      await pages[imposter].evaluate(() => localStorage.getItem('undercover.session.v1')),
    ).toBe(imposterSession);
    for (let turn = 0; turn < 3; turn++) {
      let active: Page | undefined;
      await expect
        .poll(async () => {
          for (const page of pages)
            if (await page.getByRole('textbox', { name: 'Your clue', exact: true }).count()) {
              active = page;
              return true;
            }
          return false;
        })
        .toBe(true);
      await active!
        .getByRole('textbox', { name: 'Your clue', exact: true })
        .fill(['intriguing', 'familiar', 'memorable'][turn]);
      await active!.getByRole('button', { name: 'Lock in clue' }).click();
    }
    await Promise.all(
      pages.map((p) =>
        expect(p.getByRole('heading', { name: 'Something doesn’t add up.' })).toBeVisible(),
      ),
    );
    await Promise.all(pages.map((p) => expect(p.locator('.clue-item')).toHaveCount(3)));
    await pages[0].getByRole('button', { name: 'Ready to point fingers' }).click();
    await Promise.all(
      pages.map((p) =>
        expect(p.getByRole('heading', { name: 'Who’s fooling everyone?' })).toBeVisible(),
      ),
    );
    await Promise.all(pages.map(noOverflow));
    await pages[1].screenshot({ path: testInfo.outputPath('voting-mobile.png'), fullPage: true });
    const names = ['Aster', 'Billie', 'Casey'];
    for (let i = 0; i < pages.length; i++) {
      const target =
        i === imposter ? names.find((_, index) => index !== imposter)! : names[imposter];
      await pages[i].getByRole('button', { name: `${target} Select suspect`, exact: true }).click();
      await pages[i].getByRole('button', { name: 'Lock in my vote' }).click();
    }
    await expect(pages[imposter].getByRole('heading', { name: 'Caught. Not beaten.' })).toBeVisible(
      { timeout: 15000 },
    );
    await pages[imposter].getByRole('textbox', { name: 'Guess the secret word' }).fill(word);
    await pages[imposter].getByRole('button', { name: 'Take the shot' }).click();
    await Promise.all(
      pages.map((p) =>
        expect(p.getByRole('heading', { name: 'A beautiful deception.' })).toBeVisible(),
      ),
    );
    await pages[0].screenshot({ path: testInfo.outputPath('results-desktop.png'), fullPage: true });
    await pages[0].getByRole('button', { name: 'One more round' }).click();
    await expect(pages[0].locator('.room-code')).toHaveText(code);
    await pages[0].getByRole('button', { name: 'Start the game' }).click();
    await Promise.all(
      pages.map((p) =>
        expect(p.getByRole('heading', { name: 'Every face hides a secret.' })).toBeVisible(),
      ),
    );
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});

test('landing, rules and room forms fit a narrow phone', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 740 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:5173');
    await noOverflow(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noOverflow(page);
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.getByRole('button', { name: /Create a room/ }).click();
    await expect(page.getByLabel('Your nickname')).toBeVisible();
    await noOverflow(page);
    await page.getByLabel('Your nickname').fill('Narrow phone');
    await page.getByRole('button', { name: 'Create my room' }).click();
    await expect(page.locator('.room-code')).toBeVisible();
    await noOverflow(page);
  } finally {
    await context.close();
  }
});
