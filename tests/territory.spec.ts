import { test, expect, type Page } from '@playwright/test';

const open = async (page: Page) => {
  await page.goto('./');
  await expect(page.getByLabel('Programa ativo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mapa territorial', exact: true }).click();
  await expect(page.locator('.territory-municipality')).toHaveCount(853);
};
const upload = async (page: Page, aggregation = 'none') => {
  await page.getByRole('button', { name: 'Importar valores de indicador', exact: true }).click();
  await page.getByLabel('Indicador do planejamento', { exact: true }).selectOption({ label: 'gastos/beneficiários' });
  await page.getByLabel('Período dos valores', { exact: true }).fill('2025');
  await page.getByLabel('Unidade dos valores', { exact: true }).fill('pessoas');
  await page.getByLabel('Fonte dos valores', { exact: true }).fill('Base municipal de teste');
  await page.getByLabel('Cálculo por região', { exact: true }).selectOption(aggregation);
  await page.getByLabel('Planilha de valores municipais', { exact: true }).setInputFiles({ name: 'valores.csv', mimeType: 'text/csv', buffer: Buffer.from('codigo_ibge;valor\n3106200;0\n3100104;20\n3100203;\n') });
  await expect(page.getByRole('dialog')).toContainText('3 municípios validados');
  await page.getByRole('button', { name: 'Importar valores', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.territory-source-line')).toContainText('2 de 853 municípios com dados');
};
const createScheme = async (page: Page, name: string, department: string, rows: string) => {
  await page.getByRole('button', { name: 'Criar regionalização', exact: true }).click();
  await page.getByLabel('Nome da regionalização', { exact: true }).fill(name);
  await page.getByLabel('Secretaria ou órgão da regionalização', { exact: true }).fill(department);
  await page.getByLabel('Planilha de regionalização', { exact: true }).setInputFiles({ name: 'regioes.csv', mimeType: 'text/csv', buffer: Buffer.from('codigo_ibge;regiao\n' + rows) });
  await page.getByRole('dialog').getByRole('button', { name: 'Criar regionalização', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Editar regionalização', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Concluir regionalização', exact: true }).click();
};

test('malha municipal permite seleção, zoom, pesquisa e troca de regiões IBGE', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  const map = page.getByRole('group', { name: 'Mapa interativo dos 853 municípios de Minas Gerais', exact: true });
  await expect(page.locator('.territory-municipality[data-code="3106200"]')).toHaveAttribute('aria-pressed', 'true');
  const before = await map.getAttribute('viewBox');
  await page.getByRole('button', { name: 'Ampliar mapa', exact: true }).click();
  expect(await map.getAttribute('viewBox')).not.toBe(before);
  await page.getByRole('button', { name: 'Ver Minas Gerais', exact: true }).click();
  await page.locator('.territory-municipality[data-code="3100104"]').click();
  await expect(page.getByRole('complementary', { name: 'Detalhes do município' })).toContainText('Abadia dos Dourados');
  await page.getByLabel('Pesquisar município no mapa', { exact: true }).fill('uberlandia');
  await page.getByRole('button', { name: /Uberlândia.*3170206/ }).click();
  await expect(page.getByRole('complementary', { name: 'Detalhes do município' })).toContainText('3170206');
  await page.getByLabel('Regionalização do mapa', { exact: true }).selectOption('ibge-immediate');
  await expect(page.getByLabel('Destacar região', { exact: true }).locator('option')).toHaveCount(71);
  expect(errors).toEqual([]);
});

test('cores distinguem zero de ausência e valores podem ser corrigidos e recarregados', async ({ page }) => {
  await open(page); await upload(page);
  const zero = page.locator('.territory-municipality[data-code="3106200"]');
  const other = page.locator('.territory-municipality[data-code="3100104"]');
  const missing = page.locator('.territory-municipality[data-code="3100203"]');
  expect(await zero.getAttribute('fill')).not.toBe(await missing.getAttribute('fill'));
  expect(await zero.getAttribute('fill')).not.toBe(await other.getAttribute('fill'));
  await expect(missing).toHaveAttribute('fill', '#e6e9ed');
  await expect(page.getByLabel('Valor do município selecionado', { exact: true })).toHaveValue('0');
  await page.getByLabel('Valor do município selecionado', { exact: true }).fill('12,5');
  await page.getByRole('button', { name: 'Salvar valor municipal', exact: true }).click();
  const series = await page.getByLabel('Indicador e período do mapa', { exact: true }).inputValue();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('fpo-state-v2')!).values.territory?.series[0]?.values['3106200'])).toBe(12.5);
  await page.reload(); await page.getByRole('button', { name: 'Mapa territorial', exact: true }).click();
  await page.getByLabel('Indicador e período do mapa', { exact: true }).selectOption(series);
  await expect(page.getByLabel('Valor do município selecionado', { exact: true })).toHaveValue('12,5');
  await page.locator('.profile-sel select').selectOption('Leitor');
  await expect(page.getByRole('button', { name: 'Importar valores de indicador', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Criar regionalização', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Valor do município selecionado', { exact: true })).toHaveCount(0);
});

test('regionalizações por secretaria permanecem independentes e agregam com cobertura explícita', async ({ page }) => {
  await open(page); await upload(page, 'mean');
  await createScheme(page, 'Divisão da Saúde', 'SES', '3106200;Centro\n3100104;Centro\n3100203;Centro\n');
  const health = await page.getByLabel('Regionalização do mapa', { exact: true }).inputValue();
  await page.getByLabel('Colorir mapa por', { exact: true }).selectOption('indicator');
  await page.getByLabel('Leitura dos valores', { exact: true }).selectOption('region');
  await expect(page.getByRole('complementary', { name: 'Detalhes do município' })).toContainText('10 · 2/3 municípios com dados');
  await createScheme(page, 'Divisão da Educação', 'SEE', '3106200;Metropolitana\n3100104;Triângulo\n');
  await expect(page.getByRole('complementary', { name: 'Detalhes do município' })).toContainText('Metropolitana');
  await page.getByLabel('Secretaria da regionalização', { exact: true }).selectOption('SES');
  await expect(page.getByLabel('Regionalização do mapa', { exact: true })).toHaveValue(health);
  await expect(page.getByRole('complementary', { name: 'Detalhes do município' })).toContainText('Centro');
  await page.getByRole('button', { name: 'Editar regionalização', exact: true }).click();
  await page.getByLabel('Nome da nova região', { exact: true }).fill('Região de teste');
  await page.getByRole('button', { name: 'Adicionar região', exact: true }).click();
  await page.getByRole('button', { name: 'Aplicar aos 1 selecionados', exact: true }).click();
  await page.getByRole('button', { name: 'Concluir regionalização', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Detalhes do município' })).toContainText('Região de teste');
  await page.getByLabel('Secretaria da regionalização', { exact: true }).selectOption('SEE');
  await expect(page.getByRole('complementary', { name: 'Detalhes do município' })).toContainText('Metropolitana');
});
