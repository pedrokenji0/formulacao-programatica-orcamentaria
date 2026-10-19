import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const mapButton = (page: Page) => page.getByRole('button', { name: 'Mapas de planejamento', exact: true });
const open = async (page: Page) => { await page.goto('./'); await expect(page.getByLabel('Programa ativo', { exact: true })).toBeVisible(); await mapButton(page).click(); };
const originalResource = 'Recursos financeiros da SEDE';
const resourceButton = (page: Page) => page.getByRole('button', { name: `Abrir componente ${originalResource}`, exact: true });

test('pesquisa sem acentos, filtra etapa e alterna lista sem alterar o mapa', async ({ page }) => {
  await open(page);
  await page.getByLabel('Pesquisar componentes', { exact: true }).fill('juridica');
  await expect(page.locator('.project-map-node')).toHaveCount(1);
  await expect(page.locator('.project-map-node')).toContainText('jurídica');
  await page.getByLabel('Pesquisar componentes', { exact: true }).fill('');
  await page.getByLabel('Filtrar etapa', { exact: true }).selectOption('recurso');
  await expect(page.locator('.project-map-node')).toHaveCount(8);
  await page.getByRole('button', { name: 'Lista', exact: true }).click();
  await expect(page.locator('.project-records tbody tr')).toHaveCount(8);
  await resourceButton(page).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Texto do componente', { exact: true })).toHaveValue(originalResource);
  await page.getByRole('button', { name: 'Concluir ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Mapa de Indicadores', exact: true }).click();
  await expect(page.locator('.project-records tbody tr')).toHaveCount(12);
  await expect(page.getByLabel('Filtrar etapa', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await expect(page.locator('.indicator-node')).toHaveCount(12);
  await expect(page.locator('.project-map-workspace')).not.toContainText('figura 3');
});

test('Reurb abre preenchido com 37 componentes e 12 indicadores em duas abas', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  await expect(page.locator('.project-map-workspace')).toHaveAttribute('data-map-id', 'mapa-minas-reurb');
  await expect(page.locator('.project-map-node:not(.indicator-node)')).toHaveCount(37);
  await page.getByRole('button', { name: 'Mapa de Indicadores', exact: true }).click();
  await expect(page.locator('.indicator-node')).toHaveCount(12);
  await expect(page.getByRole('region', { name: 'Mapa de indicadores do projeto' })).toContainText('gastos/beneficiários');
  await page.getByRole('button', { name: 'MaPR — Processos e Resultados', exact: true }).click();
  await resourceButton(page).click();
  await expect(page.getByLabel('Texto do componente', { exact: true })).toHaveValue(originalResource);
  await expect(page.getByLabel('Identificador do componente')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('edita, recarrega e reverte cada conjunto preservando a outra ficha e as permissões', async ({ page }) => {
  await open(page);
  await resourceButton(page).click();
  await page.getByLabel('Texto do componente', { exact: true }).fill('Recursos financeiros reformulados pela equipe');
  await page.getByRole('button', { name: 'Concluir ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Mapa de Indicadores', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir indicador gastos/beneficiários', exact: true }).click();
  await page.getByLabel('Nome do indicador', { exact: true }).fill('Gasto por beneficiário — revisão local');
  await expect(page.getByLabel('Fórmula de cálculo', { exact: true })).toHaveValue('');
  await page.getByLabel('Fórmula de cálculo', { exact: true }).fill('Gastos apurados / beneficiários no mesmo período');
  await page.getByRole('button', { name: 'Concluir ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar proposta do mapa', exact: true }).click();
  await page.reload(); await expect(page.getByLabel('Programa ativo', { exact: true })).toBeVisible(); await mapButton(page).click();
  await expect(page.locator('.project-map-chain')).toContainText('Recursos financeiros reformulados pela equipe');
  await page.getByRole('button', { name: 'Mapa de Indicadores', exact: true }).click();
  await expect(page.locator('.project-map-chain')).toContainText('Gasto por beneficiário — revisão local');
  await page.getByRole('button', { name: 'MaPR — Processos e Resultados', exact: true }).click();
  await page.getByRole('button', { name: 'Reverter MaPR para o original', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar reversão', exact: true }).click();
  await expect(resourceButton(page)).toBeVisible();
  await page.getByRole('button', { name: 'Mapa de Indicadores', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir indicador Gasto por beneficiário — revisão local', exact: true }).click();
  await expect(page.getByLabel('Fórmula de cálculo', { exact: true })).toHaveValue('Gastos apurados / beneficiários no mesmo período');
  await page.getByRole('button', { name: 'Concluir ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Ver original', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir indicador gastos/beneficiários', exact: true }).click();
  await expect(page.getByLabel('Nome do indicador', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Concluir ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Voltar à proposta', exact: true }).click();
  await page.locator('.profile-sel select').selectOption('Leitor');
  await expect(page.getByRole('button', { name: 'Reverter indicadores para o original', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Abrir indicador Gasto por beneficiário — revisão local', exact: true }).click();
  await expect(page.getByLabel('Nome do indicador', { exact: true })).toBeDisabled();
});

test('exportação de revisão inclui original e proposta do mapa único', async ({ page }) => {
  await open(page); await resourceButton(page).click();
  await page.getByLabel('Texto do componente', { exact: true }).fill('Recurso reformulado para comparação');
  await page.getByRole('button', { name: 'Concluir ficha', exact: true }).click();
  await page.getByRole('button', { name: 'Revisão do Planejamento', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar revisão qualitativa', exact: true }).click();
  const path = await (await downloaded).path();
  const payload = JSON.parse(readFileSync(path!, 'utf8'));
  expect(payload.projectMaps).toHaveLength(1);
  expect(payload.projectMaps[0].original.components).toHaveLength(37);
  expect(payload.projectMaps[0].proposal.components.find((item: { text: string }) => item.text === 'Recurso reformulado para comparação')).toBeTruthy();
  expect(payload.projectMaps[0].proposal.indicators).toHaveLength(12);
  expect(payload.projectMaps[0].proposal.actionIds).toEqual(['ppo-acao-125-1221-1082', 'ppo-acao-125-2461-4528']);
});
